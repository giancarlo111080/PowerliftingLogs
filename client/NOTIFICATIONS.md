# In-app notification catalog

The notification center derives alerts from the data already available in the signed-in workspace. Read and dismissed state is stored locally per user. Notifications open the relevant workflow; coach notifications also switch to the affected athlete first.

## Athlete notifications

| Trigger | Priority | Destination |
| --- | --- | --- |
| Today's incomplete workout (`W3D2`, for example) | Attention | Training Log |
| Tomorrow's workout | Info | Training Log |
| Workout remains incomplete for up to three days | Attention | Training Log |
| Coach rescheduled a workout in the next two weeks | Info | Schedule |
| Daily recovery check-in not recorded | Info | Performance Hub |
| Coach left a training comment | Attention | Training Log |
| New program offer requires approval | Attention | Dashboard |
| Meet is 14 days or fewer away | Info to urgent | Performance Hub |
| Weigh-in or session start is within 24 hours | Attention or urgent | Performance Hub |
| Performance or training records are waiting to sync | Attention | Sync status |
| Synchronization failed | Urgent | Sync status with retry |
| Meet-plan edit conflict | Urgent | Meet plan conflict resolution |

## Coach notifications

| Trigger | Priority | Destination |
| --- | --- | --- |
| Athlete has a recently missed/incomplete workout | Attention | Program Review |
| Athlete left a training comment | Attention | Program Review |
| Athlete reported pain of 4/10 or higher | Urgent | Intelligence Desk |
| Athlete readiness is 60 or lower | Attention | Intelligence Desk |
| Pain-limited set was logged | Urgent | Intelligence Desk |
| New lift analysis/video metadata is ready | Attention | Program Review |
| Intervention outcome review is due | Attention | Intelligence Desk |
| Athlete meet is 14 days or fewer away | Info to urgent | Intelligence Desk |
| Weigh-in or session start is within 24 hours | Attention or urgent | Intelligence Desk |
| Synchronization failed or records remain queued | Urgent or attention | Sync status |
| Meet-plan edit conflict | Urgent | Intelligence Desk |

## Add when the supporting feature exists

- Rest timer completion, including sound and vibration preference.
- Program revision summary with accept or ask-a-question action.
- Coach reply status: needs response, waiting on athlete, snoozed, and resolved.
- Missed recovery check-in escalation after a configurable interval.
- Meet registration, membership, equipment inspection, travel, and taper deadlines.
- Recommendation expiration and required pain acknowledgement.
- Account export completion, import failures, and privacy deletion completion.
- Push delivery. In-app notifications remain the canonical history and preference surface.

Pain notifications are non-diagnostic. They direct the coach to human review and should recommend qualified professional evaluation for urgent or worsening symptoms rather than generating loading advice.