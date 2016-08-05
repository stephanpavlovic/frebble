//var Clay = require('./clay');
//var clayConfig = require('./config');
//var clay = new Clay(clayConfig);

var UI = require('ui');
var ajax = require('ajax');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');
var Feature = require('platform/feature');
var Accel = require('ui/accel');
var Settings = require('settings');

var timers = null;
var entries = null;
var projects = [];

var welcome_card = new UI.Card({title: 'Freckle Timer', body: 'Open settings from the pebble app on your phone to set you personal freckle token.'});

Settings.config(
  { url: 'http://kicker.cool/freckle_settings?config=' + encodeURI(JSON.stringify(Settings.option())) },
  function(e) {
    console.log('opening configurable');
  },
  function(e) {
    console.log('closed configurable');
    if (e.failed) {
      console.log('user canceled', e.response);
    } else {
      console.log('new options', JSON.stringify( Settings.option() ));
      localStorage.setItem('token', Settings.option('token'));
      console.log('Received:', Settings.option('token'))
      appStart();
      Vibe.vibrate('short');
    }
  }
);

//Menus

var initialMenu = new UI.Menu({
  highlightBackgroundColor: Feature.color('#00AA00', 'black'),
  sections: [
    {
      title: 'Freckle Pebble App',
      items: [
        { title: 'Todays time' },
        { title: 'Active timers' },
        { title: 'New timer' }
      ]
    }
  ]
});

var resultsMenu = new UI.Menu({
  highlightBackgroundColor: Feature.color('#00AA00', 'black'),
  sections: [
    {
      title: 'Active Timers',
      items: [{title: 'Fetching timers...'}]
    }
  ]
});

var projectMenu = new UI.Menu({
  highlightBackgroundColor: Feature.color('#00AA00', 'black'),
  sections: [
    {
      title: 'Choose Project',
      items: [
        {title: 'Projects are loaded...'}
      ]
    }
  ]
});

var myAPIKey = "";//9d8hem5gr9vqc6qe0pszbz5nmzd24x2-fvihbyq97nsmmmi2s85qdjrwaddd5vu

// Menu callbacks
initialMenu.on('select', optionSelected);

resultsMenu.on('select', toggleTimer);
resultsMenu.on('longSelect', logTime);

projectMenu.on('select', startTimer);

// App Start
var token = null;
localStorage.setItem('token', '9d8hem5gr9vqc6qe0pszbz5nmzd24x2-fvihbyq97nsmmmi2s85qdjrwaddd5vu')
function appStart(){
  token = localStorage.getItem('token');
  console.log('appStart', token)
  if( token == null ) {
    welcome_card.show();
  } else {
    welcome_card.hide();
    myAPIKey = token;
    initialMenu.show();
  }
}
appStart();
//initialMenu.show();

function optionSelected(e){
  var option = e.itemIndex;
  if(option == 0){
    fetchEntries();
  }
  if(option == 1){
    resultsMenu.show();
    fetchTimers();
  }
  if(option == 2){
    projectMenu.show();
    fetchProjects();
  }
}


function menuEntry(entry){
  var title = entry.project.name;
  var subtitle = entry.state.charAt(0).toUpperCase() + ' - ' + entry.formatted_time;
  return {title: title, subtitle: subtitle};
}

function parseTimers(data) {
  var menuItems = [];
  data.forEach(function(entry) {
    menuItems.push(menuEntry(entry));
  });
  return menuItems;
}

function parseProjects(data) {
    var localProjects = [];
    var items = [];
    data.forEach(function(entry) {
      if(localProjects.indexOf(entry.project.name) == -1){
        projects.push(entry.project);
        localProjects.push(entry.project.name);
        var billable = 'Unbillable';
        if(entry.billable){
          billable = 'Billable';
        }
        items.push({title: entry.project.name, subtitle: billable})
      }
    });
    console.log('Projects', projects.length, projects[0].name)
    return items;
}

function calculateHours(data){
  var billable = 0;
  var unbillable = 0;
  entries = data;
  data.forEach(function(entry) {
    if(entry.billable == true){
      billable = billable + entry.minutes;
    }else{
      unbillable = unbillable + entry.minutes;
    }
  });

  return {'billable': billable, 'unbillable': unbillable};
}

function setResultMenu(data){
  var items = [{title: "No active Timers"}];
  if(data.length > 0){
    timers = data;
    items = parseTimers(data);
  }
  resultsMenu.items(0, items);
}

function setProjectMenu(data){
  var items = [];
  console.log('setProjectMenu: ', data.length)
  if(data.length > 0){
    items = parseProjects(data);
  }
  projectMenu.items(0, items);
}

// Make the request
function fetchProjects(){
  var entryURL = 'https://api.letsfreckle.com/v2/current_user/entries?' + '&freckle_token=' + myAPIKey;
  ajax(
    {
      url: entryURL,
      type: 'json'
    },
    function(data) {
      // Success!
      console.log("Fetch Projects", data.length);
      setProjectMenu(data);
    },
    function(error) {
      // Failure!
      console.log('Failed fetching timer data: ' + error);
      Vibe.vibrate('long');
    }
  );
}

// Make the request
function fetchTimers(){
  var baseURL = 'https://api.letsfreckle.com/v2/timers?freckle_token=' + myAPIKey;
  ajax(
    {
      url: baseURL,
      type: 'json'
    },
    function(data) {
      // Success!
      setResultMenu(data);
      Vibe.vibrate('short');
    },
    function(error) {
      // Failure!
      console.log('Failed fetching timer data: ' + error);
      Vibe.vibrate('long');
    }
  );
}

function toggleTimer(e){
  var timer = timers[e.itemIndex];
  var projectId = timer.project.id;
  var newURL = 'https://api.letsfreckle.com/v2/projects/' + projectId +'/timer/start?freckle_token=' + myAPIKey;
  if(timer.state == 'running'){
    newURL = 'https://api.letsfreckle.com/v2/projects/' + projectId +'/timer/pause?freckle_token=' + myAPIKey;
  }
  ajax(
  {
    url: newURL,
    method: 'PUT',
    type: 'json'
  },
  function(data) {
    timers[e.itemIndex].state = data.state;
    timers[e.itemIndex].formatted_time = data.formatted_time;
    resultsMenu.items(0, parseTimers(timers));
  },
  function(error) {
    // Failure!
    console.log('Failed modifying timer: ' + error);
  });
}

function startTimer(e){
  var project = projects[e.itemIndex];
  var projectId = project.id;
  var newURL = 'https://api.letsfreckle.com/v2/projects/' + projectId +'/timer/start?freckle_token=' + myAPIKey;
  console.log('startTimer', projects.length, project.name, newURL)
  ajax(
  {
    url: newURL,
    method: 'PUT',
    type: 'json'
  },
  function(data) {
    fetchTimers();
    resultsMenu.show();
  },
  function(error) {
    // Failure!
    console.log('Failed modifying timer: ' + error);
  });
}

function logTime(e){
  var timer = timers[e.itemIndex];
  var projectId = timer.project.id;
  console.log('Log Time', timers.length, projectId);
  var newURL = 'https://api.letsfreckle.com/v2/projects/' + projectId +'/timer/log?freckle_token=' + myAPIKey;
  ajax(
  {
    url: newURL,
    method: 'PUT',
    type: 'json'
  },
  function(data) {
    console.log("You should not be here!")
  },
  function(error) {
    timers.splice(e.itemIndex, 1);
    setResultMenu(timers);
    Vibe.vibrate('long');
  });
}

function fetchEntries(){
  var today = new Date().toISOString().slice(0, 10);
  var entryURL = 'https://api.letsfreckle.com/v2/current_user/entries?' + 'from=' + today + '&freckle_token=' + myAPIKey;
  console.log("EntryURL:", entryURL);
  ajax(
    {
      url: entryURL,
      type: 'json'
    },
    function(data) {
      // Success!
      content = 'No entries for today!'
      if(data.length > 0){
        amounts = calculateHours(data);
        // Add temperature, pressure etc
        content = 'Billable: ' + (amounts.billable / 60) + 'h' +
          '\n Unbillable: ' + (amounts.unbillable / 60) + 'h'
      }
      var detailCard = new UI.Card({
        title:'Todays hours',
        body: content
      });
      detailCard.show();
      Vibe.vibrate('short');
    },
    function(error) {
      // Failure!
      console.log('Failed fetching entry data: ' + error);
      Vibe.vibrate('long');
    }
  );
}

// Prepare the accelerometer
Accel.init();
// Register for 'tap' events
resultsMenu.on('accelTap', function(e) {
  fetchTimers();
})
