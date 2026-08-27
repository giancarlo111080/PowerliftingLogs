using Microsoft.AspNetCore.Mvc;
using PowerliftingProgram.Infrastructure.Services;

namespace PowerliftingProgram.Api.Controllers;

public sealed record InstagramVideoUrlRequest(string InstagramVideoUrl);

[ApiController]
[Route("api/instagram")]
public sealed class CoachingController(InstagramVideoUrlPolicy instagramVideoUrlPolicy) : ControllerBase
{
    [HttpPost("validate-video-url")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public ActionResult ValidateVideoUrl([FromBody] InstagramVideoUrlRequest request)
    {
        if (!instagramVideoUrlPolicy.IsAllowed(request.InstagramVideoUrl))
        {
            ModelState.AddModelError(nameof(request.InstagramVideoUrl), "Provide a public Instagram post or reel URL.");
            return ValidationProblem(ModelState);
        }

        return NoContent();
    }
}
