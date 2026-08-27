using System.Text.Json.Serialization;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var jwtConfiguration = builder.Configuration.GetSection("Authentication:Jwt");
var jwtSigningKey = jwtConfiguration["SigningKey"] ?? throw new InvalidOperationException("Authentication:Jwt:SigningKey is required.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtConfiguration["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtConfiguration["Audience"],
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("client", policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:8081", "http://localhost:19006"])
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
        await database.Database.EnsureCreatedAsync();
    }
    else if (app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
    {
        await database.Database.MigrateAsync();
    }

    if (app.Configuration.GetValue<bool>("Database:SeedSampleDataOnStartup"))
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

app.UseHttpsRedirection();
app.UseCors("client");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program;
