using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PowerliftingProgram.Infrastructure.Persistence;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration["Database:Provider"] ?? "Postgres";

        if (provider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            var databaseName = configuration["Database:InMemoryName"] ?? "powerlifting-program-development";
            services.AddDbContext<TrainingDbContext>(options => options.UseInMemoryDatabase(databaseName));
        }
        else if (provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
        {
            var connectionString = configuration.GetConnectionString("TrainingDatabase")
                ?? throw new InvalidOperationException("Connection string 'TrainingDatabase' is required for the Postgres provider.");
            services.AddDbContext<TrainingDbContext>(options => options.UseNpgsql(connectionString));
        }
        else
        {
            throw new InvalidOperationException("Database:Provider must be either 'InMemory' or 'Postgres'.");
        }

        services.AddScoped<WorkoutSyncService>();
        services.AddSingleton<InstagramVideoUrlPolicy>();
        return services;
    }
}
