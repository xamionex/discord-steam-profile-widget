# Steam Discord Widget

Automatically sync your Steam profile with Discord Profile Widgets.

This project updates a Discord widget with data from your Steam profile, including:

* Avatar
* Persona name
* Online status (including current game)
* Steam level
* Currently / most recently played game
* Games owned count
* Recent (2 week) playtime
* Profile age
* Badge count
* Friend count
* Recent (2 week) hours
* All time most played game
* Most played game in the last 2 weeks

## Features

* Automatic Steam profile syncing
* Dynamic avatar support
* Live online / in-game status
* Steam Web API powered (reliable, no scraping)
* GitHub Actions support
* No self-hosting required

## Requirements

Before using this project, you must already have:

* A Discord application
* A published Discord Profile Widget
* A Bot Token
* Your Application ID
* Your Discord User ID
* A Steam Web API key (https://steamcommunity.com/dev/apikey)
* Your SteamID64 (the 17 digit id, e.g. `76561197960287930`)

> This project does **not** create Discord widgets. It only updates an existing widget.

## Creating a Discord Profile Widget

Before using this project, you need to create and publish a Discord Profile Widget.

Follow Chloe Cinders' guide:

https://chloecinders.com/blog/discord-widgets

The guide covers:

* Creating a Discord application
* Enabling the Social SDK
* Creating widget fields
* Publishing the widget
* Authorizing the application
* Adding the widget to your Discord profile

Once your widget is set up, return here and configure the required fields below.

## Widget Configuration

Create the following fields in your Discord widget. The `name` of each field must match
exactly, otherwise the data will not bind.

| Name          | Type   |
| ------------- | ------ |
| avatar        | Media  |
| username      | String |
| status        | String |
| level         | Number |
| last_played   | String |
| games         | Number |
| playtime      | String |
| profile_age   | String |
| badges        | Number |
| friends       | Number |
| recent_playtime | Number |
| most_played_game | String |
| most_played_recent_game | String |

### Important

For the image field, make sure:

```txt
Value Type: User Data
Data Field: avatar
```

Do **not** use `Application Asset`, otherwise the avatar will not update dynamically.

> `level`, `games`, `badges`, `friends` and `recent_playtime` are sent as numbers (payload `type: 2`),
> so set them up as `Number` fields in the widget editor and let the widget design supply any labels.
> `playtime` and `profile_age` stay `String` because they carry units (`hrs`, `years`).
>
> `recent_playtime` is the same 2 week total as `playtime`, just as a bare number instead of a
> `"X.X hrs"` string. Pick whichever fits your widget design; you do not need both.

## Installation

Install dependencies:

```bash
npm install
```

## Configuration

Create a `.env` file (see `.env.example`):

```env
BOT_TOKEN=YOUR_BOT_TOKEN
APPLICATION_ID=YOUR_APPLICATION_ID
USER_ID=YOUR_DISCORD_USER_ID
STEAM_API_KEY=YOUR_STEAM_WEB_API_KEY
STEAM_ID=YOUR_STEAMID64
```

Example:

```env
BOT_TOKEN=xxxxxxxx
APPLICATION_ID=123456789012345678
USER_ID=987654321098765432
STEAM_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
STEAM_ID=76561197960287930
```

## Usage

Run manually:

```bash
node update-widget.js
```

To verify the Steam half without touching Discord, run a dry run. This prints the payload that
would be sent and skips the Discord update (only `STEAM_API_KEY` and `STEAM_ID` are required):

```bash
DRY_RUN=1 node update-widget.js
```

## GitHub Actions

Create the following repository secrets:

* BOT_TOKEN
* APPLICATION_ID
* USER_ID
* STEAM_API_KEY
* STEAM_ID

The included workflow (`.github/workflows/update-widget.yml`) runs `node update-widget.js`
every 2 hours and on manual dispatch.

## How It Works

The script:

1. Calls the Steam Web API for your profile:

   * `GetPlayerSummaries` (avatar, persona, status, current game, profile age)
   * `GetSteamLevel` (Steam level)
   * `GetOwnedGames` (games owned count, all time most played game)
   * `GetRecentlyPlayedGames` (last played game, 2 week playtime/hours, 2 week most played game)
   * `GetBadges` (badge count)
   * `GetFriendList` (friend count)
2. Maps the data to your widget fields.
3. Updates your Discord Profile Widget using Discord's Application Identities API.

## Troubleshooting

### Avatar does not update

Make sure the widget image is configured as:

```txt
Value Type: User Data
Data Field: avatar
```

Using `Application Asset` will display a static image instead of the dynamic avatar.

### Game / playtime / badges / friends / profile age fields show 0, None or Unknown

These fields depend on Steam privacy settings:

* `games`, `playtime`, `recent_playtime`, `most_played_game` and `most_played_recent_game` require
  **Game details** set to **Public**.
* `friends` requires your **Friends list** set to **Public**.
* `badges` and `profile_age` require your overall profile to be **Public**.

When a section is private, the field falls back to `0`, `None`, or `Unknown`.

### Stats are not updating

Verify:

* BOT_TOKEN is valid
* APPLICATION_ID is correct
* USER_ID is correct
* STEAM_API_KEY is valid
* STEAM_ID is your 17 digit SteamID64
* GitHub Actions secrets are configured properly

## Disclaimer

This project relies on:

* Steam's Web API
* Discord's experimental Application Identities API

Future changes by either service may affect functionality.

## Credits

Special thanks to Chloe Cinders for her Discord Profile Widgets guide:

https://chloecinders.com/blog/discord-widgets

Prior art: the original Steam profile widget by @wooslow and the Letterboxd widget this project
was adapted from.
