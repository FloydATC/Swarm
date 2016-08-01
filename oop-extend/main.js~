
//var m_universe = require('Universe');
//var Universe = m_universe.c_universe;

var extend_game = require('Game');
var extend_creep = require('Creep');
var extend_room = require('Room');
var extend_source = require('Source');
var extend_s_container = require('StructureContainer');
var extend_s_spawn = require('StructureSpawn');
var extend_s_storage = require('StructureStorage');
var extend_s_tower = require('StructureTower');


module.exports.loop = function () {

    // Scavenge dead creeps
    var memory_names = Object.keys(Memory.creeps);
    for(var i in memory_names) {
        var name = memory_names[i];
        var tombstone = Memory.creeps[name];
        if (Game.creeps[name] == null) {
            console.log(tombstone.class+' '+name+' has died in '+tombstone.where+' at age '+tombstone.age);
            delete Memory.creeps[name];
        }
    }
    console.log(Game.cpu.getUsed().toFixed(3)+' scavenged dead creeps');

    // Extend game object instance (can't extend class?)
    for (var key in extend_game) { Game[key] = extend_game[key]; }

    // Extend game classes with custom methods
    for (var key in extend_creep) { Creep.prototype[key] = extend_creep[key]; }
    for (var key in extend_room) { Room.prototype[key] = extend_room[key]; }
    for (var key in extend_source) { Source.prototype[key] = extend_source[key]; }
    for (var key in extend_s_container) { StructureContainer.prototype[key] = extend_s_container[key]; }
    for (var key in extend_s_spawn) { StructureSpawn.prototype[key] = extend_s_spawn[key]; }
    for (var key in extend_s_storage) { StructureStorage.prototype[key] = extend_s_storage[key]; }
    for (var key in extend_s_tower) { StructureTower.prototype[key] = extend_s_tower[key]; }
    console.log(Game.cpu.getUsed().toFixed(3)+' extended game classes');

    Game.initialize(); // Model current game state
    console.log(Game.cpu.getUsed().toFixed(3)+' initialized game model');

    // Day to day operations
    for (var name in Game.rooms) {
        var room = Game.rooms[name];

        room.plan();
        console.log(Game.cpu.getUsed().toFixed(3)+' planned '+room);
        room.optimize();
        console.log(Game.cpu.getUsed().toFixed(3)+' optimized '+room);
        room.execute();
        console.log(Game.cpu.getUsed().toFixed(3)+' executed '+room);

    }
    console.log('(finished)');

    // console.log(Game.cpu.getUsed());
}
