using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Application.Validators;
using PowerliftingProgram.Infrastructure;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var jwtConfiguration = builder.Configuration.GetSection("Authentication:Jwt");
var jwtSigningKey = jwtConfiguration["SigningKey"];
var isLocalEnvironment = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("LocalPostgres");
if (string.IsNullOrWhiteSpace(jwtSigningKey) || Encoding.UTF8.GetByteCount(jwtSigningKey) < 64)
{
    throw new InvalidOperationException("Authentication:Jwt:SigningKey must be configured with at least 64 bytes for HS512.");
}
if (!isLocalEnvironment && (jwtSigningKey.Contains("development-only", StringComparison.OrdinalIgnoreCase) || jwtSigningKey.Contains("replace-with", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Authentication:Jwt:SigningKey must be supplied from production secret storage.");
}
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtConfiguration["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtConfiguration["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userIdValue = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var sessionVersionValue = context.Principal?.FindFirst("session_version")?.Value;
                if (!Guid.TryParse(userIdValue, out var userId) || !int.TryParse(sessionVersionValue, out var sessionVersion))
                {
                    context.Fail("The session token is invalid.");
                    return;
                }

                var database = context.HttpContext.RequestServices.GetRequiredService<TrainingDbContext>();
                var sessionIsCurrent = await database.PlatformUsers.AsNoTracking().AnyAsync(
                    user => user.Id == userId && user.SessionVersion == sessionVersion,
                    context.HttpContext.RequestAborted);
                if (!sessionIsCurrent)
                {
                    context.Fail("The session has been revoked.");
                }
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("authentication", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            AutoReplenishment = true,
            PermitLimit = 10,
            QueueLimit = 0,
            Window = TimeSpan.FromMinutes(1)
        }));
    options.AddPolicy("invitations", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            AutoReplenishment = true,
            PermitLimit = 20,
            QueueLimit = 0,
            Window = TimeSpan.FromHours(1)
        }));
});
var configuredClientOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .Select(origin => origin.TrimEnd('/'))
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .ToHashSet(StringComparer.OrdinalIgnoreCase);
builder.Services.AddCors(options => options.AddPolicy("client", policy => policy
    .SetIsOriginAllowed(origin =>
    {
        var normalizedOrigin = origin.TrimEnd('/');
        if (configuredClientOrigins.Contains(normalizedOrigin))
        {
            return true;
        }

        return isLocalEnvironment
            && Uri.TryCreate(normalizedOrigin, UriKind.Absolute, out var candidate)
            && candidate.IsLoopback
            && (candidate.Scheme == Uri.UriSchemeHttp || candidate.Scheme == Uri.UriSchemeHttps);
    })
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddValidatorsFromAssemblyContaining<LoggedSetValidator>();
builder.Services.AddSingleton<IFatigueModelingService, FatigueModelingService>();
builder.Services.AddSingleton<ITrainingCalculationService, TrainingCalculationService>();
builder.Services.AddScoped<IGamificationService, GamificationService>();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<TrainingDbContext>();
    var provider = app.Configuration["Database:Provider"] ?? "Postgres";
    if (provider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
    {
        app.Logger.LogWarning("The in-memory database is active. Accounts and training data will be lost when the API process stops.");
        await database.Database.EnsureCreatedAsync();
    }
    else if (app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
    {
        await database.Database.MigrateAsync();
    }

    var seedSampleData = app.Configuration.GetValue<bool>("Database:SeedSampleDataOnStartup");
    if (seedSampleData && !isLocalEnvironment)
    {
        throw new InvalidOperationException("Sample data can only be seeded in Development or LocalPostgres environments.");
    }
    if (seedSampleData)
    {
        var passwordHashingService = scope.ServiceProvider.GetRequiredService<PasswordHashingService>();
        await TrainingDatabaseSeeder.SeedAsync(database, passwordHashingService);
    }
}

if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("LocalPostgres"))
{
    app.UseSwagger();
    app.MapScalarApiReference(options => options
        .WithTitle("Iron Forge API")
        .WithOpenApiRoutePattern("/swagger/{documentName}/swagger.json"));
}

if (!isLocalEnvironment)
{
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseCors("client");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program;
