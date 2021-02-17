# TarkovSpeechBot
This is a bot that gives prices for items on the tarkov flea market.  ill update this more some day, but i stole the initial code from https://github.com/healzer/DiscordSpeechBot

# Install
1. Clone this repo somewhere
2. cd into the directory
3. run `cp settings-sample.json settings.json`
4. make changes to `settings.json`. just put the keys in the right places
5. run `npm install`
6. run `node index.js`

# Using bot
Text commands are !join and !leave.  !Join will have the bot connect to the voice channel the user is in.  After connecting, user can say "Get price <item>" and if the bot understood it will say the item and price.  
  
Wit.ai likely needs to be trained, as it doesnt recognize tarkov specific items, like 'Salewa'.  It also has trouble transciribing numbers, like "san 203" will transcribe as "san two oh three" which wont be found.
