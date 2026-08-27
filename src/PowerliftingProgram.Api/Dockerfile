FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_EnableDiagnostics=0

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY ["src/PowerliftingProgram.Api/PowerliftingProgram.Api.csproj", "src/PowerliftingProgram.Api/"]
COPY ["src/PowerliftingProgram.Application/PowerliftingProgram.Application.csproj", "src/PowerliftingProgram.Application/"]
COPY ["src/PowerliftingProgram.Domain/PowerliftingProgram.Domain.csproj", "src/PowerliftingProgram.Domain/"]
COPY ["src/PowerliftingProgram.Infrastructure/PowerliftingProgram.Infrastructure.csproj", "src/PowerliftingProgram.Infrastructure/"]
RUN dotnet restore "src/PowerliftingProgram.Api/PowerliftingProgram.Api.csproj"
COPY . .
RUN dotnet publish "src/PowerliftingProgram.Api/PowerliftingProgram.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM runtime AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "PowerliftingProgram.Api.dll"]
