
var extend_game = require('Game');
var extend_creep = require('Creep');
var extend_flag = require('Flag');
var extend_room = require('Room');
var extend_source = require('Source');
var extend_s_container = require('StructureContainer');
var extend_s_link = require('StructureLink');
var extend_s_spawn = require('StructureSpawn');
var extend_s_storage = require('StructureStorage');
var extend_s_tower = require('StructureTower');
var profiler = require('Profiler');
var show_perf = false;

profiler.enable(); // Game.profiler.profile(100) -or- Game.profiler.email(100)
module.exports.loop = function() {
    profiler.wrap(function() {

//module.exports.loop = function () {

    // Scavenge dead creeps
    if (Game.time % 87 == 0) {
        var memory_names = Object.keys(Memory.creeps);
        for(var i in memory_names) {
            var name = memory_names[i];
            var tombstone = Memory.creeps[name];
            if (Game.creeps[name] == null) {
                console.log(tombstone.class+' '+name+' has died in '+tombstone.where+' at age '+tombstone.age);
                delete Memory.creeps[name];
            }
        }
        if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' scavenged dead creeps'); }
    }

    // Extend game object instance (can't extend class?)
    for (var key in extend_game) { Game[key] = extend_game[key]; }


    // Extend game classes with custom methods
    for (var key in extend_creep) { Creep.prototype[key] = extend_creep[key]; }
    for (var key in extend_flag) { Flag.prototype[key] = extend_flag[key]; }
    for (var key in extend_room) { Room.prototype[key] = extend_room[key]; }
    for (var key in extend_source) { Source.prototype[key] = extend_source[key]; }
    for (var key in extend_s_container) { StructureContainer.prototype[key] = extend_s_container[key]; }
    for (var key in extend_s_link) { StructureLink.prototype[key] = extend_s_link[key]; }
    for (var key in extend_s_spawn) { StructureSpawn.prototype[key] = extend_s_spawn[key]; }
    for (var key in extend_s_storage) { StructureStorage.prototype[key] = extend_s_storage[key]; }
    for (var key in extend_s_tower) { StructureTower.prototype[key] = extend_s_tower[key]; }

    if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' extended game classes'); }

    Game.initialize(); // Model current game state
    if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' initialized game model'); }

    // Day to day operations
    for (var name in Game.rooms) {
        var room = Game.rooms[name];

        room.plan();
        if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' planned '+room); }
        room.optimize();
        if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' optimized '+room); }
        room.execute();
        if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' executed '+room); }

        if (Game.time % 100 == 0) {
            room.expire_routes();
            if (show_perf) { console.log(Game.cpu.getUsed().toFixed(3)+' expired routes '+room); }
            if (show_perf) { console.log(room+' routing table: '+roughSizeOfObject(Memory.rooms[room.name].router)+' bytes (est.)'); }


        }

        if (Game.time % 1000 == 0) {
            // Reset road votes
            for (var name in Memory.rooms) { delete Memory.rooms[name].votes; }
        }

    }
    if (show_perf) { console.log('(finished)'); }


    }); // Profiler
}

//}

function roughSizeOfObject( object ) {

    var objectList = [];
    var stack = [ object ];
    var bytes = 0;

    while ( stack.length ) {
        var value = stack.pop();

        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            bytes += value.length * 2;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
        (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
        )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    return bytes;
}


/*
doctorpc
1:30 PM my tip for you would be: try to make hardcoded things and processes instead take in hardcoded variables.
1:31 preferably a single object/array that contains everything the task needs
1:31 you can then later learn to auto-generate that object
1:31 and auto-generate what it took you to auto generate the object
1:31 so on and so forth
1:31 a really nice work flow for slow automation.
*/


/*
doctorpc
1:21 PM he put it quite elegantly
1:21 "V1 of my attack script had my creeps kill the spawn in the room, once it killed all the enemies"
1:21 "V2 added checks to see if the spawn was my own"
1:21 xD
*/

/*

daboross
8:38 AM yeah, I'm pretty sure it's possible to get values that are currently in the memory tree from an external API - I'm not sure of the officialness of it
8:38 there are things like https://github.com/screepers/screeps-stats which do this, that and https://github.com/screepers/screeps-grafana might both be good sources for usages of that API
GitHub
screepers/screeps-stats
screeps-stats - Access Screeps Console, Performance, and Statistics Data via Kibana and ElasticSearch
GitHub
screepers/screeps-grafana
screeps-grafana - Pretty graphs for screeps
*/

/*
puciek
12:06 PM

Dear [sir and/or madam],

You have been [removed/harassed/starved out] from [insert room here] on [date].

Main reason for [removal/harassment/starvation] was [I want your room/boredom/smacktalking] and the main reason why it
worked so well were [empty turrets/broken turret code/not sufficent storage/awful turret placement]. If you need to
[write angry words/call someone a noob/get revenge/get help and git gut] then you are best to [undefined/undefined/respawn/join screeps slack] or message [person who removed you] directly.

[Have a great day/Praise the sun]
[Person who removed you]
*/
