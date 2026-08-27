using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Infrastructure.Services;

public sealed class PasswordHashingService
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 210_000;

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA512, HashSize);
        return $"v1.{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string encodedHash)
    {
        var segments = encodedHash.Split('.', StringSplitOptions.None);
        if (segments.Length != 4 || segments[0] != "v1" || !int.TryParse(segments[1], out var iterations))
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(segments[2]);
            var expectedHash = Convert.FromBase64String(segments[3]);
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA512, expectedHash.Length);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

public sealed class JwtTokenService(IConfiguration configuration)
{
    public string Create(PlatformUser user)
    {
        var jwt = configuration.GetSection("Authentication:Jwt");
        var signingKey = jwt["SigningKey"] ?? throw new InvalidOperationException("Authentication:Jwt:SigningKey is required.");
        if (Encoding.UTF8.GetByteCount(signingKey) < 64)
        {
            throw new InvalidOperationException("Authentication:Jwt:SigningKey must be at least 64 bytes for HS512.");
        }

        var expiresInHours = jwt.GetValue<int?>("ExpiresInHours") ?? 12;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Role, user.Role.ToString().ToUpperInvariant())
        };
        if (user.CoachId is Guid coachId)
        {
            claims.Add(new Claim("coach_id", coachId.ToString()));
        }

        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha512);
        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(expiresInHours),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}