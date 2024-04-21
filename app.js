const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');
//const login = require("fca-unofficial");
const login = require("fb-chat-support");
const axios = require('axios');
const path = require('path');
const { logReceivedMessage, logAppStateFound } = require('./OctoCore/log');
require('./commands-settings');
const { getPrefixList, processCommand } = require('./OctoCore/main');
const filename = 'data.json';
const filePath = path.join(__dirname, 'cookie.json');
const app = express();
const port = process.env.PORT || 3000;

//serve static file
app.use(bodyParser.json());
app.use(express.static('public')); 

//auto restart
setInterval(() => {
  process.exit();
}, 30 * 60 * 1000);

//restartbutton
app.post('/api/restartBot', (req, res) => {
  const { restartInterval } = req.body;
  if (restartInterval) {
    const timeoutMs = restartInterval * 60 * 1000;
    res.json({ success: true, message: `Bot will restart in ${restartInterval} minutes.` });
    setTimeout(() => {
      process.exit(1);
    }, timeoutMs);
  } else {
    res.status(400).json({ success: false, message: 'Invalid request. Provide a restart interval.' });
  }
});

// POST route to handle form submission and update krukis.txt
app.post('/updateKrukisTxt', (req, res) => {
    const newContent = req.body.newContent;

    // Write the new content to krukis.txt
    fs.writeFile(filePath, newContent, 'utf8', err => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).json({ message: 'Error updating krukis.txt' });
        }
        res.json({ message: 'Content updated successfully' });
    });
});
//another
function addUid(uid) {
    // Read the existing JSON file
    const jsonString = fs.readFileSync(filename, 'utf-8');

    // Decode JSON string to JavaScript object
    const data = JSON.parse(jsonString);

    // Check if UID already exists
    if (data.ChatWithAiOfficialUserIDs.includes(uid)) {
        return { message: `UID ${uid} is already registered.` };
    } else {
        // Add UID to the array
        data.ChatWithAiOfficialUserIDs.push(uid);

        // Encode object back to JSON and save to the file
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));

        return { message: `UID ${uid} has been successfully added.` };
    }
}

function deleteUid(uid) {
    // Read the existing JSON file
    const jsonString = fs.readFileSync(filename, 'utf-8');

    // Decode JSON string to JavaScript object
    const data = JSON.parse(jsonString);

    // Check if UID exists
    const key = data.ChatWithAiOfficialUserIDs.indexOf(uid);
    if (key !== -1) {
        // Remove UID from the array
        data.ChatWithAiOfficialUserIDs.splice(key, 1);

        // Encode object back to JSON and save to the file
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));

        return { message: `UID ${uid} has been successfully deleted.` };
    } else {
        return { message: `UID ${uid} not found.` };
    }
}
// Express route to fetch the content of nukos.json
// Express route to fetch the entire content of nukos.json
app.get('/nukos.json', (req, res) => {
    try {
        const jsonString = fs.readFileSync(filename, 'utf-8');
        res.json(JSON.parse(jsonString));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Express route for handling requests to add or delete UIDs
app.get('/manage-uids', (req, res) => {
    const action = req.query.action;
    const uid = req.query.uid;

    // Check for the 'action' and 'uid' parameters in the query string
    if (action && uid) {
        // Perform the specified action
        if (action === 'add') {
            res.json(addUid(uid));
        } else if (action === 'delete') {
            res.json(deleteUid(uid));
        } else {
            res.status(400).json({ message: 'Invalid action specified.' });
        }
    } else {
        res.status(400).json({ message: "Missing 'action' or 'uid' parameter in the URL." });
    }
});

// Express route for displaying all registered UIDs
app.get('/uids', (req, res) => {
    // Read the existing JSON file
    const jsonString = fs.readFileSync(filename, 'utf-8');

    // Decode JSON string to JavaScript object
    const data = JSON.parse(jsonString);

    // Send the list of UIDs as a response
    res.json({ message: 'List of registered UIDs', uids: data.ChatWithAiOfficialUserIDs });
});
//Connection Bot (fs )
login({ appState: JSON.parse(fs.readFileSync("cookie.json")) }, async (err, api) => {
      try {
        if (err) throw err;

        logAppStateFound();

        api.listenMqtt(async (err, event) => {
          try {
            if (err) throw err;

            switch (event.type) {
              case "message":
                const sender = event.senderID;
                const prefix = getPrefixList();

                logReceivedMessage(sender, event.body);

                if (prefix.includes(event.body[0])) {
                  await processCommand(api, event, sender).catch(async (e) => {
                    console.error('Error processing command:', e);
                    api.sendMessage(`0x0f1: Application error\n0x0f2: ${e}`, event.threadID);
                  });
                }
                break;
            }
          } catch (err) {
            console.error('Error in message event:', err);
          }
        });
      } catch (err) {
        console.error('Error in login:', err);
      }
    });
/*
// connection bot (axios)
const dstryrStatePath = path.join(__dirname, './dstryr_state.json');

try {
  const dstryrStateContent = fs.readFileSync(dstryrStatePath, 'utf-8');
  const dstryrState = JSON.parse(dstryrStateContent);
  const appStateUrl = dstryrState.cookieUrl;

  axios.get(appStateUrl)
    .then(response => {
      const appState = response.data;

      login({ appState }, async (err, api) => {
        if (err) {
          console.error('Error in login:', err);
          return;
        }

        logAppStateFound();

        api.listenMqtt(async (err, event) => {
          if (err) {
            console.error('Error in listenMqtt:', err);
            return;
          }

          switch (event.type) {
            case "message":
              const sender = event.senderID;
              const prefix = getPrefixList();

              logReceivedMessage(sender, event.body);

              if (prefix.includes(event.body[0])) {
                await processCommand(api, event, sender).catch(async (e) => {
                  console.error('Error in processCommand:', e);
                  api.sendMessage(`0x0f1: Application error\n0x0f2: ${e}`, event.threadID);
                });
              }
          }
        });
      });
    })
    .catch(error => {
      console.error('Error fetching app state:', error);
    });
} catch (error) {
  console.error('Error reading dstryr_state.json:', error);
}
*/
// Express route to fetch the content of krukis.txt
app.get('/krukis.txt', (req, res) => {
    try {
        const krukisTxtContent = fs.readFileSync(path.join(__dirname, 'cookie', 'krukis.txt'), 'utf-8');
        res.send(krukisTxtContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}); 
//listen to port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
//  console.log(`\nDEVELOPED BY: REJARDGWAPO`);
});