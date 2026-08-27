namespace PowerliftingProgram.Infrastructure.Services;

public sealed class InstagramVideoUrlPolicy
{
    public bool IsAllowed(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var isInstagramHost = uri.Scheme == Uri.UriSchemeHttps
            && (uri.Host.Equals("instagram.com", StringComparison.OrdinalIgnoreCase)
                || uri.Host.EndsWith(".instagram.com", StringComparison.OrdinalIgnoreCase));
        return isInstagramHost && (uri.AbsolutePath.StartsWith("/p/", StringComparison.OrdinalIgnoreCase)
            || uri.AbsolutePath.StartsWith("/reel/", StringComparison.OrdinalIgnoreCase));
    }
}
