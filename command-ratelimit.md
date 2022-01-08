# Command Ratelimit

### Command Ratelimit Object

###### Command Ratelimit Structure

| FIELD   | TYPE                | DESCRIPTION                |
| ------- | ------------------- | -------------------------- |
| type    | integer             | [Command Ratelimit Type]() |
| ids     | array of snowflakes |                            |
| period  | integer             | $1                         |
| bucket  | integer             |                            |
| warning | boolean             |                            |

###### Command Ratelimit Types

| NAME  | TYPE | DESCRIPTION           |
| ----- | ---- | --------------------- |
| GUILD | 1    | guild id in ids field |
| USER  | 2    | user id in ids field  |

###### Example Command Ratelimit

```json
{
  "id": 1233,
  "type": 1
}
```

###### Command Ratelimit Types

## Premium

| FEATURE                   | USER | GUILD |
| ------------------------- | :--: | :---: |
| Unlimited playlist tracks |  ✓   |   ✕   |
| Autoplay                  |  ✕   |   ✓   |
| 24/7                      |  ✕   |   ✓   |
| Edit default buttons      |  ✕   |   ✓   |
| Unlimited queue tracks    |  ✕   |   ✓   |
| Audio effects             |  ✓   |   ✓   |
| Bypass vote locked        |  ✓   |   ✓   |
| Release command ratelimit |  ✓   |   ✓   |

### Vote Locked

| Command |
| ------- |
| Lyrics  |
| Volume  |
| Volume  |
