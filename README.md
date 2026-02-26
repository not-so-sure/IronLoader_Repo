# Mod loader for Iron Nest game on Steam
 - https://discord.gg/E92DaqgnZv
 - https://store.steampowered.com/app/2950790/IRON_NEST_Heavy_Turret_Simulator/

## Setup

### Windows

Open a powershell instance and run these commands in this order:
1. `powershell -c "irm https://community.chocolatey.org/install.ps1|iex"`
2. `choco install nodejs --version="24.14.0"`

After that, you should run:

3. `npm -v`
4. `node -v`

If nothing is returned from either 3 or 4, you did something wrong.

Next, open a command prompt and run `mkdir ironloader & cd ironloader`

After than, run `npm init -y`

And finally run `npm install electron --save-dev`

Copy the path and open it in file explorer. You will need to download and move the files from here on github into the ironloader folder. When it asks you to replace or ignore, tell it to replace, or it will not work properly.

After you do this, return to your command prompt and run `npm start` and you should have the interface open.
