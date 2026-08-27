using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;
using PowerliftingProgram.Application.Validators;
using PowerliftingProgram.Infrastructure;
using PowerliftingProgram.Infrastructure.Persistence;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
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
        await TrainingDatabaseSeeder.SeedAsync(database);
    }
}

if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("LocalPostgres"))
{
    app.UseSwagger();
    app.MapScalarApiReference(options => options
        .WithTitle("Powerlifting Program API")
        .WithOpenApiRoutePattern("/swagger/{documentName}/swagger.json"));
}

app.UseHttpsRedirection();
app.UseCors("client");
app.MapControllers();
app.Run();

public partial class Program;
