# Solmar Bay: Heatwave

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01/)
[![Rank](https://make.fun/badge/gta6-01/Jelly-RayTian/gta6-01/rank.svg)](https://make.fun/c/gta6-01/)
[![Reward](https://make.fun/badge/gta6-01/Jelly-RayTian/gta6-01/reward.svg)](https://make.fun/c/gta6-01/)

An original open-world crime game for the make.fun "Make GTA 6" bounty. You are Danny Cole, fresh off the
bus in the sun-soaked coastal city of Solmar Bay, working off a debt for fixer Rita Vance: steal, drive,
run from the law and take down the Harbor Kings crew and their boss, Victor Hale.

Everything is original and procedural: city, vehicles, characters, story, sounds (WebAudio) and music. No
audio or image files, no network. three.js is vendored (`game/vendor/three.module.min.js`).

## Run
```
node serve.ts          # then open http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts   # build the hand-in (game/, screenshots/, dossier.json)
```

## Features
City grid with downtown, beach, residential, park and docks districts; on-foot and driving (5 vehicle
types, arcade handling, handbrake drifts); traffic that stops, honks and avoids; pedestrians that flee;
carjacking; 0-5 star wanted level with chasing cruisers, on-foot officers, roadblocks and arrests; five
story missions with rewards; pistol combat with cover-taking enemies, reloads, melee, hospital
respawn; HUD with live minimap; title, pause, mission list, wasted and busted screens; localStorage save.

## Controls
WASD move / drive, Shift sprint, Space jump / handbrake, mouse look (click to capture pointer), left click
shoot, right mouse aim, R reload, F punch, E enter / exit car, H horn, Tab missions, Esc pause.
