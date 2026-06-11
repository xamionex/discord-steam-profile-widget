require("dotenv").config({ quiet: true });

const axios = require("axios");

const STEAM_API = "https://api.steampowered.com";

// Steam personastate -> human readable label.
const PERSONA_STATE = {
  0: "Offline",
  1: "Online",
  2: "Busy",
  3: "Away",
  4: "Snooze",
  5: "Looking to trade",
  6: "Looking to play"
};

async function steamGet(path, params) {
  const { data } = await axios.get(`${STEAM_API}${path}`, {
    params: { key: process.env.STEAM_API_KEY, ...params },
    headers: {
      "User-Agent": "discord-steam-profile-widget"
    }
  });
  return data;
}

function formatHours(minutes) {
  const hours = (minutes || 0) / 60;
  return `${hours.toFixed(1)} hrs`;
}

// Account age from the unix creation timestamp. Whole years, or months when under a year.
function formatProfileAge(timeCreated) {
  if (!timeCreated) {
    return "Unknown";
  }
  const created = new Date(timeCreated * 1000);
  const now = new Date();
  let months =
    (now.getFullYear() - created.getFullYear()) * 12 +
    (now.getMonth() - created.getMonth());
  if (now.getDate() < created.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    months = 0;
  }
  const years = Math.floor(months / 12);
  if (years >= 1) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

async function updateWidget() {
  const steamId = process.env.STEAM_ID;

  if (!process.env.STEAM_API_KEY) {
    throw new Error("STEAM_API_KEY missing");
  }
  if (!steamId) {
    throw new Error("STEAM_ID missing");
  }

  // Player summary: avatar, persona, status, current game.
  const summaryRes = await steamGet("/ISteamUser/GetPlayerSummaries/v0002/", {
    steamids: steamId
  });

  const player = summaryRes?.response?.players?.[0];
  if (!player) {
    throw new Error(`No Steam profile found for STEAM_ID ${steamId}`);
  }

  // Cache bust so Discord refetches the image when it changes.
  const avatar =
    (player.avatarfull ||
      "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg") +
    `?v=${Date.now()}`;

  const username = player.personaname || "Unknown";

  const inGameName = player.gameextrainfo;
  const status = inGameName
    ? `In-Game: ${inGameName}`
    : PERSONA_STATE[player.personastate] ?? "Offline";

  // Account age (timecreated is only present on public profiles).
  const profileAge = formatProfileAge(player.timecreated);

  // Steam level (own endpoint). Sent as a number (widget field type 2).
  let level = 0;
  try {
    const levelRes = await steamGet("/IPlayerService/GetSteamLevel/v1/", {
      steamid: steamId
    });
    if (levelRes?.response?.player_level != null) {
      level = levelRes.response.player_level;
    }
  } catch (err) {
    console.warn("Could not fetch Steam level:", err.message);
  }

  // Owned games count + all time most played (requires public game details).
  let games = 0;
  let mostPlayedGame = "None";
  let totalPlaytimeMinutes = 0;
  try {
    const ownedRes = await steamGet("/IPlayerService/GetOwnedGames/v1/", {
      steamid: steamId,
      include_appinfo: 1,
      include_played_free_games: 1
    });
    const ownedGames = ownedRes?.response?.games || [];
    if (ownedRes?.response?.game_count != null) {
      games = ownedRes.response.game_count;
    }
    const topOwned = ownedGames.reduce(
      (top, game) =>
        (game.playtime_forever || 0) > (top?.playtime_forever || 0) ? game : top,
      null
    );
    if (topOwned?.name) {
      mostPlayedGame = topOwned.name;
    }
    // Sum all playtime_forever to get total playtime
    totalPlaytimeMinutes = ownedGames.reduce(
      (sum, game) => sum + (game.playtime_forever || 0),
      0
    );
  } catch (err) {
    console.warn("Could not fetch owned games:", err.message);
  }

  const totalPlaytime = formatHours(totalPlaytimeMinutes);

  // Recently played: last played, summed 2 week playtime, and 2 week most played.
  let lastPlayed = inGameName || "None";
  let playtime = "0.0 hrs";
  let recentHours = 0;
  let mostPlayedRecentGame = "None";
  try {
    const recentRes = await steamGet(
      "/IPlayerService/GetRecentlyPlayedGames/v1/",
      { steamid: steamId }
    );
    const recentGames = recentRes?.response?.games || [];

    if (!inGameName && recentGames[0]?.name) {
      lastPlayed = recentGames[0].name;
    }

    const recentMinutes = recentGames.reduce(
      (sum, game) => sum + (game.playtime_2weeks || 0),
      0
    );
    playtime = formatHours(recentMinutes);
    recentHours = Math.round((recentMinutes / 60) * 10) / 10;

    const topRecent = recentGames.reduce(
      (top, game) =>
        (game.playtime_2weeks || 0) > (top?.playtime_2weeks || 0) ? game : top,
      null
    );
    if (topRecent?.name) {
      mostPlayedRecentGame = topRecent.name;
    }
  } catch (err) {
    console.warn("Could not fetch recently played games:", err.message);
  }

  // Badge count (requires public profile). Sent as a number (type 2).
  let badges = 0;
  try {
    const badgesRes = await steamGet("/IPlayerService/GetBadges/v1/", {
      steamid: steamId
    });
    if (Array.isArray(badgesRes?.response?.badges)) {
      badges = badgesRes.response.badges.length;
    }
  } catch (err) {
    console.warn("Could not fetch badges:", err.message);
  }

  // Friend count (requires a public friends list). Sent as a number (type 2).
  let friends = 0;
  try {
    const friendsRes = await steamGet("/ISteamUser/GetFriendList/v1/", {
      steamid: steamId,
      relationship: "friend"
    });
    if (Array.isArray(friendsRes?.friendslist?.friends)) {
      friends = friendsRes.friendslist.friends.length;
    }
  } catch (err) {
    console.warn("Could not fetch friends:", err.message);
  }

  const payload = {
    username,
    data: {
      dynamic: [
        {
          type: 3,
          name: "avatar",
          value: {
            url: avatar
          }
        },
        {
          type: 1,
          name: "username",
          value: username
        },
        {
          type: 1,
          name: "status",
          value: status
        },
        {
          type: 2,
          name: "level",
          value: level
        },
        {
          type: 1,
          name: "last_played",
          value: lastPlayed
        },
        {
          type: 2,
          name: "games",
          value: games
        },
        {
          type: 1,
          name: "playtime",
          value: playtime
        },
        {
          type: 1,
          name: "total_playtime",
          value: totalPlaytime
        },
        {
          type: 1,
          name: "profile_age",
          value: profileAge
        },
        {
          type: 2,
          name: "badges",
          value: badges
        },
        {
          type: 2,
          name: "friends",
          value: friends
        },
        {
          type: 2,
          name: "recent_playtime",
          value: recentHours
        },
        {
          type: 1,
          name: "most_played_game",
          value: mostPlayedGame
        },
        {
          type: 1,
          name: "most_played_recent_game",
          value: mostPlayedRecentGame
        }
      ]
    }
  };

  // DRY_RUN lets you verify the Steam half without touching Discord.
  if (process.env.DRY_RUN === "1") {
    console.log("DRY_RUN enabled, skipping Discord update.");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!process.env.APPLICATION_ID || !process.env.USER_ID || !process.env.BOT_TOKEN) {
    throw new Error("APPLICATION_ID, USER_ID and BOT_TOKEN are required to update Discord");
  }

  await axios.patch(
    `https://discord.com/api/v9/applications/${process.env.APPLICATION_ID}/users/${process.env.USER_ID}/identities/0/profile`,
    payload,
    {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent":
          "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"
      }
    }
  );

  console.log("✅ Widget updated");
  console.log("👤 User:", username);
  console.log("🎮 Status:", status);
  console.log("🕹 Last played:", lastPlayed);
  console.log("📈 Level:", level);
  console.log("🎲 Games:", games);
  console.log("⏱ Recent playtime:", playtime);
  console.log("⏳ Total playtime:", totalPlaytime);
  console.log("📅 Profile age:", profileAge);
  console.log("🏅 Badges:", badges);
  console.log("🤝 Friends:", friends);
  console.log("🕑 Recent hours:", recentHours);
  console.log("🏆 Most played:", mostPlayedGame);
  console.log("🔥 Most played (2w):", mostPlayedRecentGame);
}

updateWidget().catch(err => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
