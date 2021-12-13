# Command Ratelimit

### Command Ratelimit Object

###### Command Ratelimit Structure

| FIELD   | TYPE                | DESCRIPTION                |
| ------- | ------------------- | -------------------------- |
| type    | integer             | [Command Ratelimit Type]() |
| ids     | array of snowflakes |                            |
| bucket  | integer             |                            |
| period  | are neat            | $1                         |
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
