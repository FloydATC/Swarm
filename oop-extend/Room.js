
module.exports = {}; // Nothing.
var Routingtable = require('Routingtable');

Room.prototype.initialize = function() {
    //console.log(this.link()+' initializing');
    this.my_creeps = this.find(FIND_MY_CREEPS);
    this.my_creeps = this.my_creeps.sort( function(a,b) { return a.ticksToLive - b.ticksToLive; } );
    this.dropped_energy = this.find(FIND_DROPPED_ENERGY);
    this.dropped_other = this.find(FIND_DROPPED_RESOURCES, { filter: function(r) { return r.resourceType != RESOURCE_ENERGY; } });

    if (typeof this.sources == 'undefined') { this.sources = this.find(FIND_SOURCES); } // Re-use if possible
    //this.spawns = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_SPAWN; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
    //this.towers = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_TOWER; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
    //this.roads = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_ROAD; } });
    //this.roads = this.find_roads();
    //this.links = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_LINK; } });
    //this.extensions = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_EXTENSION; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
    //this.extensions = this.find_extensions();
    //this.containers = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_CONTAINER; } });

    this.storage_energy_pct = 0;
    if (this.storage) {
        this.storage_energy_pct = this.storage.energy * 100 / this.storage.storeCapacity;
    }

    //this.extractor = null;
    //this.extractors = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_EXTRACTOR; } });
    //if (this.extractors.length > 0) { this.extractor = this.extractors[0]; }

    //this.storage = this.find(FIND_STRUCTURES, { filter: function(s) { s.structureType == STRUCTURE_STORAGE; } });
    this.construction_sites = this.find(FIND_CONSTRUCTION_SITES); //.sort( function(a,b) { return b.progress - a.progress; } ); // Nearest completion first
    var ambition = this.hp_ambition();
    //this.need_repairs = this.find(FIND_STRUCTURES, { filter: function(s) { return s.hits && s.hits < ambition && s.hits < s.hitsMax; } }).sort( function(a,b) { return (a.hits - b.hits) || (a.ticksToDecay - b.ticksToDecay); } ); // Most urgent first

    // Scan structures
    this.extractor = null;
    this.containers = [];
    this.links = [];
    this.roads = [];
    this.spawns = [];
    this.towers = [];
    this.extensions = [];
    this.need_repairs = [];
    this.structures = this.find(FIND_STRUCTURES);
    for (let i in this.structures) {
        let s = this.structures[i];
        if (s.hits && s.hits < ambition && s.hits < s.hitsMax) { this.need_repairs.push(s); }
        switch (s.structureType) {
            case STRUCTURE_EXTRACTOR:   this.extractor = s;         break;
            case STRUCTURE_CONTAINER:   this.containers.push(s);    break;
            case STRUCTURE_LINK:        this.links.push(s);         break;
            case STRUCTURE_ROAD:        this.roads.push(s);         break;
            case STRUCTURE_SPAWN:       this.spawns.push(s);        break;
            case STRUCTURE_TOWER:       this.towers.push(s);        break;
            case STRUCTURE_EXTENSION:   this.extensions.push(s);    break;
        }
    }
    this.spawns.sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
    this.towers.sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
    //this.extensions.sort( function(a,b) { return a.energy - b.energy; } ); // NO POINT, we always consider nearest first
    //this.need_repairs.sort( function(a,b) { return (a.hits - b.hits) || (a.ticksToDecay - b.ticksToDecay); } ); // NO POINT, we always consider nearest first

    this.timer = {}; // Used by .start_timer() and .stop_timer()
    this.total = {}; // Accumulated timers, used by .show_totals()

    // Used to calculate total and average link energy levels
    this.link_count = 0;
    this.link_total = 0;
    this.link_average = 0;

    // Scan for hostiles
    // Filter against those who have permission to enter ("whitelist")
    this.hostile_creeps = this.find(FIND_HOSTILE_CREEPS);
    if (typeof this.memory.allow == 'undefined') { this.memory.allow = []; }
    if (this.memory.allow.length > 0 && this.hostile_creeps.length > 0) {
        //console.log(this.link()+' hostiles before filter: '+this.hostile_creeps.length);
        for (let i in this.memory.allow) {
            let player = this.memory.allow[i];
            if (player == '*') { this.hostile_creeps = []; } // Free for all
            if (this.hostile_creeps.length == 0) { break; }
            //console.log(this.link()+' allow player '+player);
            //console.log('  pre='+this.hostile_creeps);
            this.hostile_creeps = _.filter(this.hostile_creeps, function(creep) {
                //console.log('    creep='+creep+' owner='+creep.owner+' username="'+creep.owner.username+'" player="'+player+'"');
                return (creep.owner.username != player);
            } );
            //console.log('  post='+this.hostile_creeps);
        }
        //console.log(this.link()+' hostiles after filter: '+this.hostile_creeps.length);
    }

    // Record presence of hostiles in case we lose visual - used by other rooms to assist
    this.memory.hostiles = this.hostile_creeps.length;
    this.memory.scanned = Game.time;


    // Sum of dropped energy on the floor
    var total = 0;
    _.forEach(this.dropped_energy, function(nrg) { total += nrg.amount } );
    this.total_dropped_energy = total;

    // Owned room?
    if (this.controller && this.controller.my) {
        // There should be a flag on the controller to coordinate the upgrading efforts
        if (this.flag == null) {
            var flagname = 'controller '+this.name;
            this.createFlag(this.controller.pos, flagname);
            if (typeof Memory.flags[flagname] == 'undefined') { Memory.flags[flagname] = {}; }
            Memory.flags[flagname].controller = this.controller.id;
        }
        // There should also be a flag on each Source to coordinate mining efforts
        for (var i=0; i<this.sources.length; i++) {
            var source = this.sources[i];
            if (source.flag == null) {
                var flagname = 'source '+this.name+'-'+i;
                this.createFlag(source.pos, flagname);
                if (typeof Memory.flags[flagname] == 'undefined') { Memory.flags[flagname] = {}; }
                Memory.flags[flagname].source = source.id;
            }
        }
        // There should also be a flag on each Extractor to coordinate mining efforts
        if (this.extractor) {
            if (this.extractor.flag == null) {
                var flagname = 'extract '+this.name;
                this.createFlag(this.extractor.pos, flagname);
                if (typeof Memory.flags[flagname] == 'undefined') { Memory.flags[flagname] = {}; }
                Memory.flags[flagname].extractor = this.extractor.id;
            }
        }
    }

    // Request reinforcements if room is owned but has no spawn
    if (this.controller && this.controller.my && this.spawns.length == 0 && this.my_creeps.length < 10) {
        Game.request_drones = this.name;
    }

    // Check if dedicated upgrader is alive
    if (this.memory.upgrader != null) {
        var creep = Game.getObjectById(this.memory.upgrader);
        //console.log(this.link()+' this.memory.upgrader '+this.memory.upgrader+' is '+creep);
        if (creep != null && creep.memory.class == 'Zealot') {
            //console.log(this.link()+' dedicated upgrader is '+creep);
            this.upgrader = creep;
        } else {
            //console.log(this.link()+' this.memory.upgrader '+this.memory.upgrader+' ** INVALID/MISSING **');
            this.memory.upgrader = null;
        }
    }




    for (var i=0; i<this.links.length; i++) { this.links[i].initialize(); }
    for (var i=0; i<this.my_creeps.length; i++) { this.my_creeps[i].initialize(); }
    for (var i=0; i<this.towers.length; i++) { this.towers[i].initialize(); }
    for (var i=0; i<this.sources.length; i++) { this.sources[i].initialize(); }
    for (var i=0; i<this.spawns.length; i++) { this.spawns[i].initialize(); }
    for (var i=0; i<this.containers.length; i++) { this.containers[i].initialize(); }
    if (this.storage != null) { this.storage.initialize(); }
    if (this.terminal != null) { this.terminal.initialize(); }

    //console.log(this.link()+' containers: '+this.containers);
    //this.containers = this.containers.sort( function(a,b) { return a.free - b.free; } ); // Note: Must initialize before sorting
}

Room.prototype.under_attack = function() {
    let hostiles = this.hostile_creeps.length;
    let mem = this.memory.hostiles;
    if (mem == null) { mem = 0; }
    if (mem == 0 && hostiles > 0) { console.log(this.link()+' IS UNDER ATTACK'); }
    if (mem > 0 && hostiles == 0) { console.log(this.link()+' no longer under attack'); }
    this.memory.hostiles = hostiles;
    return (hostiles > 0); // true if hostiles spotted
}

/*Room.prototype.get_exits = function(direction) {
    var encoded = this.memory.exits[direction];
    //console.log(this.link()+' direction '+direction+' encoded exits = '+encoded);
    var decoded = [];
    if (encoded == null) { return decoded; }
    for (var i=0; i<encoded.length; i++) {
        var value = encoded.charCodeAt(i);
        decoded.push( { x: value % 50, y: Math.floor(value / 50) } );
    }
    return decoded;
}*/

Room.prototype.manhattanDistance = function(p1, p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

Room.prototype.plan = function() {
    var sources = this.sources.slice();
    var spawns = this.spawns.slice();
    var towers = this.towers.slice();
    var links = this.links.slice();
    var drops = this.dropped_other.slice();
    var extensions = this.extensions;
    var containers = this.containers.slice().reverse(); // 3 with least energy
    //var storage = this.storage.slice().reverse(); // 3 with least energy
    var my_creeps = this.my_creeps.slice(); // All classes
    var hostile_creeps = this.hostile_creeps.slice();
    var csites = this.construction_sites.slice(0,2); // Max 3 at a time
    var need_repairs = this.need_repairs.slice(0,2); // Max 3 at a time

    var dismantlers = [];   // Dismantle structures (local or remote)
    var miners = [];        // Mine energy (local or remote)
    var extractors = [];    // Mine resources
    var reservers = [];     // Reserve room controller
    var fetchers = [];      // Fetch energy from remote mines
    var zealots = [];       // Camp next to controller and upgrade it
    var drones = [];        // Generic workers
    var swarmers = [];      // Move to remote room then mutate into Infectors
    var infectors = [];     // Claim controller then mutate into Drone
    var biters = [];        // Basic attack unit
    var spitters = [];      // Basic ranged attack unit
    var hunters = [];       // Medium ranged attack unit
    var berserkers = [];    // Heavy attack unit

    // Sort creeps into classes
    for (var i in my_creeps) {
        var creep = my_creeps[i];
        if (typeof creep == 'object') {
            if (!creep.memory.class) { creep.memory.class = 'Drone'; console.log(this.link()+' AMNESIAC '+creep+' assigned to Drone class'); }
            if (creep.memory.class == 'Dismantler') { dismantlers.push(creep);  continue; }
            if (creep.memory.class == 'Miner')      { miners.push(creep);       continue; }
            if (creep.memory.class == 'Extractor')  { extractors.push(creep);   continue; }
            if (creep.memory.class == 'Reserver')   { reservers.push(creep);    continue; }
            if (creep.memory.class == 'Fetcher')    { fetchers.push(creep);     continue; }
            if (creep.memory.class == 'Zealot')     { zealots.push(creep);      continue; }
            if (creep.memory.class == 'Drone')      { drones.push(creep);       continue; }
            if (creep.memory.class == 'Swarmer')    { swarmers.push(creep);     continue; }
            if (creep.memory.class == 'Infector')   { infectors.push(creep);    continue; }
            if (creep.memory.class == 'Biter')      { biters.push(creep);       continue; }
            if (creep.memory.class == 'Spitter')    { spitters.push(creep);     continue; }
            if (creep.memory.class == 'Hunter')     { hunters.push(creep);      continue; }
            if (creep.memory.class == 'Berserker')  { berserkers.push(creep);   continue; }
            console.log(this.link()+' unhandled creep class '+creep.memory.class);
        } else {
            console.log(this.link()+' POSSIBLE SERVER ERROR: INVALID CREEP type='+(typeof creep)+' creep='+creep);
        }
    }

    // Role based tasks
    this.assign_task_hunt(berserkers);
    this.assign_task_hunt(hunters);
    this.assign_task_attack(biters);
    this.assign_task_ranged_attack(spitters);
    this.assign_task_travel(swarmers);
    this.assign_task_claim(infectors);
    this.assign_task_mine(miners);
    this.assign_task_dismantle(dismantlers);
    this.assign_task_extract(extractors);
    this.assign_task_reserve(reservers);
    this.assign_task_remote_fetch(fetchers);
    this.assign_task_upgrade(zealots);


    // Controller critical?
    this.assign_task_controller(drones);

    // Spawn needs energy?
    this.assign_task_feed_spawn(drones, spawns);

    // Tower needs energy?
    this.assign_task_feed_tower(drones, towers);

    // Links can aid the feeding of towers
    this.assign_task_feed_link(drones, links);

    // Enemies dropped loot?
    this.assign_task_pick_up(drones, drops);

    // Extensions needs energy?
    this.assign_task_feed_extension(drones, extensions);

    // Repair stuff?
    this.assign_task_repair(drones, need_repairs);

    // Build stuff?
    this.assign_task_build(drones, csites);

    // Storage needs energy? (scale aggressively)
    this.assign_task_stockpile(drones, this.storage);

    // Terminal needs energy? (low priority)
    this.assign_task_feed_terminal(drones, this.terminal);

    // FINALLY: Any leftover drones? Upgrade
    this.assign_task_upgrade(drones);


    // Under attack? Plan A: Spawn berserker. Plan B: Release a hunter. Plan C: Spam tiny fighters and hope for the best
    if (this.hostile_creeps.length > 0) {
        if (this.controller && this.controller.my && this.controller.level >= 7) {
            if (this.createCreep(this.schematic('Berserker'), undefined, { class: 'Berserker', destination: this.name })) { return; }
        }
        // Try to spawn a hunter
        if (hunters.length == 0) {
            if (this.createCreep(this.schematic('Hunter'), undefined, { class: 'Hunter', destination: this.name }) == OK) { return; }
            // Emergency, spawn biters and spitters if possible
            //if (Math.random() > 0.80) { this.createCreep(this.schematic('Healer'), undefined, { class: 'Healer' }); return; }
            if (this.my_creeps.length < 16) {
                if (Math.random() > 0.50) { this.createCreep(this.schematic('Spitter'), undefined, { class: 'Spitter' }); return; }
                this.createCreep(this.schematic('Biter'), undefined, { class: 'Biter' });
                return;
            }
        }
    } else {
        // If we are NOT under attack, check for other rooms that may require assistance
        for (var name in Memory.rooms) {
            if (name == this.name) { continue; } // Assist self? Duh.
            if (name == 'E26N36') { console.log('IGNORE E26N36 FOR NOW'); continue; }
            if (this.energyAvailable < 500) { continue; } // Low on energy
            if (this.storage == null || this.storage_energy_pct < 50) { continue; } // Not in a good position to help
            //console.log(name+' hostiles='+Memory.rooms[name].hostiles);
            //console.log(name+' scanned='+Memory.rooms[name].scanned);
            let range = Game.manhattanDistance(this.name, name);
            //console.log(name+' distance to '+this.name+' is '+range);
            if (range <= 3) {
                if (Memory.rooms[name].hostiles > 0 && Memory.rooms[name].scanned > Game.time - 1000) {
                    //console.log(this.link(name)+' is under attack, '+this.link()+' checking energy reserves ('+this.calc_spawn_reserves().toFixed(1)+'%)');
                    if (this.calc_spawn_reserves() > 75) {
                        //console.log('  '+this.link()+' spawning assistance!');
                        // Spawn a hunter to assist!
                        var result = this.createCreep(this.schematic('Hunter'), undefined, { class: 'Hunter', destination: name })
                        //console.log('  result='+result);
                        return;
                    } else {
                        //console.log('  '+this.link()+' unable to assist');
                    }
                }
            }
        }
    }

    if (this.source_flags) {
        //console.log(this.link()+' has source flags to consider: '+this.source_flags);
        for (var i in this.source_flags) {
            var flag = this.source_flags[i];
            var needs = flag.needs();
            if (needs == 'Miner') {
                //console.log(this.link()+' spawning a local miner for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Miner.3'), undefined, { class: 'Miner', home: this.name, mine: this.name, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Miner.2'), undefined, { class: 'Miner', home: this.name, mine: this.name, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Miner.1'), undefined, { class: 'Miner', home: this.name, mine: this.name, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Miner', home: this.name, mine: this.name, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Miner'); }
                return;
            }
        }
    }
    if (this.spawns.length > 0) {
        var drone_spawn_interval = CREEP_LIFE_TIME / this.want_drones();
        var drone_spawn_timer = Game.time - (this.memory.last_drone_spawned || 0);
        //console.log(this.link()+' drone spawn timer: '+drone_spawn_timer+' interval: '+drone_spawn_interval);
        if (drone_spawn_timer >= drone_spawn_interval) {
            // Experimental clockwork spawning of drones
            //console.log(this.link()+' needs to spawn a new Drone');

            // Try to spawn a drone appropriate for this room controller level
            var result = null;
            for (var level=this.controller.level; level>0; level--) {
                result = this.createCreep(this.schematic('Drone.'+level), undefined, { class: 'Drone' });
                if (result == OK) { break; }
                if (result == ERR_NOT_ENOUGH_ENERGY) { continue; }
                //console.log(this.link()+' createCreep returned '+result);
                break;
            }
            //console.log(this.link()+' Drone spawn result='+result);
            if (result == OK) { this.memory.last_drone_spawned = Game.time; }
            return;
        }

        let colonize_interval = 100;
        //console.log(this.link()+' time='+Game.time+' ('+(Game.time % colonize_interval)+'/'+colonize_interval+') colonize='+(Game.colonize ? 'yes' : 'no')+' request='+(Game.request_drones ? 'yes' : 'no'));
        if (this.under_attack() == false && Game.time % colonize_interval == 0) {
            if (Game.colonize) {
                if (this.can_colonize(Game.colonize)) {
                    if (Game.manhattanDistance(this.name, Game.colonize) <= 3) {
                        console.log(this.link()+' spawning a creep to claim '+Game.colonize);
                        var result = this.createCreep([MOVE,CARRY,WORK,CLAIM], undefined, { class: 'Swarmer', destination: Game.colonize });
                        return;
                    } else {
                        console.log(this.link()+' would like to help colonize but, gee, '+Game.colonize+' is awfully far away: '+Game.manhattanDistance(this.name, Game.colonize));
                    }
                } else {
                    console.log(Game.colonize+' can not be colonized at this time');
                }
            }
            if (Game.request_drones) {
                if (Game.rooms[Game.request_drones] && Game.rooms[Game.request_drones].controller && Game.rooms[Game.request_drones].controller.my == true) {
                    if (Game.manhattanDistance(this.name, Game.request_drones) <= 3) {
                        console.log(this.link()+' spawning a creep to build spawn in '+Game.request_drones);
                        // Try to spawn a drone appropriate for this room controller level
                        var result = null;
                        for (var level=this.controller.level; level>0; level--) {
                            result = this.createCreep(this.schematic('Drone.'+level), undefined, { class: 'Swarmer', destination: Game.request_drones });
                            if (result == OK) { break; }
                            if (result == ERR_NOT_ENOUGH_ENERGY) { continue; }
                            //console.log(this.link()+' createCreep returned '+result);
                            break;
                        }
                        //var result = this.createCreep(this.schematic('Drone'), undefined, { class: 'Swarmer', destination: Game.request_drones });
                        return;
                    } else {
                        console.log(this.link()+' would like to help build but, gee, '+Game.request_drones+' is awfully far away: '+Game.manhattanDistance(this.name, Game.request_drones));
                    }
                } else {
                    console.log(Game.request_drones+' cis currently unavailable for building');
                }
            }
        }
    }
    if (this.controller && this.controller.flag && this.under_attack() == false) {
        var flag = this.controller.flag;
        var needs = flag.needs();
        //console.log(this.link()+' flag '+flag+' needs '+needs);
        if (needs == 'Zealot') {
            //console.log(this.link()+' spawning a zealot for '+flag.pos.roomName);
            var result = ERR_NOT_ENOUGH_ENERGY;
            if (this.storage && this.storage.energy_pct >= 75) {
                // Boost upgrading if the room is doing well
                result = this.createCreep(this.schematic('Zealot.2'), undefined, { class: 'Zealot', home: this.name, flag: flag.name } );
            }
            if (this.storage && this.storage.energy_pct >= 25) {
                // Regular upgrading unless we are critical
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Zealot.1'), undefined, { class: 'Zealot', home: this.name, flag: flag.name } ); }
            }
            if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Zealot', home: this.name, flag: flag.name } ); }
            if (result == OK) { flag.spawned('Zealot'); }
            //console.log('spawn zealot: '+result);
            return;
        }
    }
    if (this.harvest_flags && this.under_attack() == false) {
        //console.log(this.link()+' has harvest flags to consider: '+this.harvest_flags);
        for (var i in this.harvest_flags) {
            var flag = this.harvest_flags[i];
            var needs = flag.needs();
            if (needs == 'Miner') {
                //console.log(this.link()+' spawning a remote miner for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Miner.3'), undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Miner.2'), undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Miner.1'), undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Miner'); }
                return;
            }
            if (needs == 'Fetcher') {
                //console.log(this.link()+' spawning a remote fetcher for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Fetcher.2'), undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Fetcher.1'), undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Fetcher'); }
                return;
            }
        }
    }
    if (this.dismantle_flags && this.under_attack() == false) {
        //console.log(this.link()+' has dismantle flags to consider: '+this.dismantle_flags);
        for (var i in this.dismantle_flags) {
            var flag = this.dismantle_flags[i];
            var needs = flag.needs();
            //console.log(this.link()+' owned flag '+flag+' needs '+needs);
            if (needs == 'Dismantler') {
                //console.log(this.link()+' spawning a dismantler for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Dismantler.3'), undefined, { class: 'Dismantler', home: this.name, dismantle: flag.pos.roomName, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Dismantler.2'), undefined, { class: 'Dismantler', home: this.name, dismantle: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Dismantler.1'), undefined, { class: 'Dismantler', home: this.name, dismantle: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Dismantler', home: this.name, dismantle: flag.pos.roomName, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Dismantler'); }
                return;
            }
            if (needs == 'Fetcher') {
                //console.log(this.link()+' spawning a remote fetcher for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Fetcher.2'), undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Fetcher.1'), undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Fetcher'); }
                return;
            }
        }
    }
    if (this.reserve_flags && this.under_attack() == false) {
        //console.log(this.link()+' has harvest flags to consider: '+this.harvest_flags);
        for (var i in this.reserve_flags) {
            var flag = this.reserve_flags[i];
            var needs = flag.needs();
            // Check room reservation if possible. Above 4500? Don't spawn reserver just yet.
            var res_ticks = 0;
            if (Game.rooms[flag.pos.roomName] && Game.rooms[flag.pos.roomName].controller && Game.rooms[flag.pos.roomName].controller.reservation) {
                res_ticks = Game.rooms[flag.pos.roomName].controller.reservation.ticksToEnd;
            }
            if (needs == 'Reserver' && res_ticks <= 4500) {
                //console.log(this.link()+' spawning a remote miner for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Reserver'), undefined, { class: 'Reserver', home: this.name, reserve: flag.pos.roomName, flag: flag.name } );
                if (result == OK) { flag.spawned('Reserver'); }
                return;
            }
        }
    }
    if (false && this.extractor_flags && this.storage && this.storage.energy_pct > 75 && this.terminal && this.terminal.free_pct > 25 &&  this.under_attack() == false) {
        //console.log(this.link()+' has extractor flags to consider: '+this.extractor_flags);
        for (var i in this.extractor_flags) {
            var flag = this.extractor_flags[i];
            var needs = flag.needs();
            if (needs == 'Extractor') {
                //console.log(this.link()+' spawning a local Extractor for '+flag.pos.roomName);
                var result = this.createCreep(this.schematic('Extractor.3'), undefined, { class: 'Extractor', home: this.name, extract: this.name, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Extractor.2'), undefined, { class: 'Extractor', home: this.name, extract: this.name, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep(this.schematic('Extractor.1'), undefined, { class: 'Extractor', home: this.name, extract: this.name, flag: flag.name } ); }
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Extractor', home: this.name, extract: this.name, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Extractor'); }
                return;
            }
        }
    }
}

Room.prototype.rangeFromTo = function(pos1, pos2) {
    if (pos1.roomName != pos2.roomName) { return Infinity; }
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

Room.prototype.optimize = function() {
    // Swap tasks where it makes sense

    // Calculate each creep's range to target
    for (var i=0; i<this.my_creeps.length; i++) {
        //this.my_creeps[i].range_to_target = this.my_creeps[i].pos.getRangeTo(Game.getObjectById(this.my_creeps[i].target));
        var target = Game.getObjectById(this.my_creeps[i].target);
        if (target == null) { this.my_creeps[i].range_to_target = 0; continue; }
        this.my_creeps[i].range_to_target = this.rangeFromTo(this.my_creeps[i].pos, target.pos);
    }

    // For each creep, if both are same class, would they benefit from swapping targets?
    for (var i=0; i<this.my_creeps.length; i++) {
        var creep_a = this.my_creeps[i];
        if (creep_a.range_to_target <= 1) { continue; } // Pointless
        if (creep_a.memory.working == false) { continue; } // Out of energy
        var target_a = Game.getObjectById(creep_a.target);
        if (target_a == null) { continue; } // Target no longer valid}
        for (var j=0; j<this.my_creeps.length; j++) {
            var creep_b = this.my_creeps[j];
            if (creep_a.id == creep_b.id) { continue; } // Same creep
            if (creep_b.range_to_target <= 1) { continue; } // Pointless
            if (creep_b.memory.working == false) { continue; } // Out of energy
            if (creep_a.memory.class != creep_b.memory.class) { continue; } // Not same class of creep
            var target_b = Game.getObjectById(creep_b.target);
            if (target_b == null) { continue; } // Target no longer valid
            if (target_a.id == target_b.id) { continue; } // Same target
            var catb = this.rangeFromTo(creep_a.pos, target_b.pos);// creep_a.pos.getRangeTo(target_b)
            var cbta = this.rangeFromTo(creep_b.pos, target_a.pos);// creep_b.pos.getRangeTo(target_a)
            if (cbta+1 < creep_b.range_to_target && catb+1 < creep_a.range_to_target) {
                // Both would benefit
                //console.log(this.link()+' creeps '+creep_a+' ('+creep_a.range_to_target+'>'+catb+') and '+creep_b+' ('+creep_b.range_to_target+'>'+cbta+')  swapped targets');
                var target = creep_a.target;
                var task = creep_a.task;
                var range_to_target = creep_a.range_to_target;
                creep_a.target = creep_b.target;
                creep_a.task = creep_b.task;
                creep_a.range_to_target = creep_b.range_to_target;
                creep_b.target = target;
                creep_b.task = task;
                creep_b.range_to_target = range_to_target;
                creep_a.say('swap');
                creep_b.say('swap');
            }
        }
    }
}


Room.prototype.link = function(name) {
    let roomname = name || this.name;
    return '<A href="https://screeps.com/a/#!/room/'+roomname+'">'+roomname+'</A>';
}


Room.prototype.repairable = function() {
    return this.find(FIND_STRUCTURES, { filter: function(s) { return s.hits != undefined && s.hits < s.hitsMax; } });
}

Room.prototype.schematic = function(c) {
    var hash = {};
    switch (c) {
        case 'Spitter': { hash[RANGED_ATTACK] = 1; hash[MOVE] = 1; break; }
        case 'Biter': { hash[ATTACK] = 1; hash[MOVE] = 1; break; }
        case 'Berserker': { hash[TOUGH] = 6; hash[MOVE] = 16; hash[ATTACK] = 28; break; }
        case 'Hunter': { hash[TOUGH] = 2; hash[MOVE] = 5; hash[RANGED_ATTACK] = 4; hash[HEAL] = 4; break; }
        case 'Miner.3': { hash[WORK] = 5; hash[CARRY] = 1; hash[MOVE] = 3; break; }
        case 'Miner.2': { hash[WORK] = 3; hash[CARRY] = 1; hash[MOVE] = 2; break; }
        case 'Miner.1': { hash[WORK] = 2; hash[CARRY] = 1; hash[MOVE] = 1; break; }
        case 'Dismantler.3': { hash[WORK] = 20; hash[CARRY] = 1; hash[MOVE] = 12; break; }
        case 'Dismantler.2': { hash[WORK] = 10; hash[CARRY] = 1; hash[MOVE] = 6; break; }
        case 'Dismantler.1': { hash[WORK] = 5; hash[CARRY] = 1; hash[MOVE] = 3; break; }
        case 'Extractor.3': { hash[WORK] = 5; hash[CARRY] = 1; hash[MOVE] = 3; break; }
        case 'Extractor.2': { hash[WORK] = 3; hash[CARRY] = 1; hash[MOVE] = 2; break; }
        case 'Extractor.1': { hash[WORK] = 2; hash[CARRY] = 1; hash[MOVE] = 1; break; }
        case 'Fetcher.1': { hash[WORK] = 1; hash[CARRY] = 5; hash[MOVE] = 3; break; }
        case 'Fetcher.2': { hash[WORK] = 1; hash[CARRY] = 10; hash[MOVE] = 6; break; }
        case 'Zealot.2': { hash[WORK] = 10; hash[CARRY] = 1; hash[MOVE] = 1; break; }
        case 'Zealot.1': { hash[WORK] = 5; hash[CARRY] = 1; hash[MOVE] = 1; break; }
        case 'Reserver': { hash[CLAIM] = 2; hash[MOVE] = 1; break; }
        case 'Drone.1': { hash[WORK] = 1; hash[CARRY] = 1; hash[MOVE] = 1; break; }
        case 'Drone.2': { hash[WORK] = 2; hash[CARRY] = 2; hash[MOVE] = 2; break; }
        case 'Drone.3': { hash[WORK] = 3; hash[CARRY] = 3; hash[MOVE] = 3; break; }
        case 'Drone.4': { hash[WORK] = 4; hash[CARRY] = 4; hash[MOVE] = 4; break; }
        case 'Drone.5': { hash[WORK] = 6; hash[CARRY] = 6; hash[MOVE] = 6; break; }
        case 'Drone.6': { hash[WORK] = 8; hash[CARRY] = 8; hash[MOVE] = 8; break; }
        case 'Drone.7': { hash[WORK] = 10; hash[CARRY] = 10; hash[MOVE] = 10; break; }
        default: { hash[WORK] = 3; hash[CARRY] = 3; hash[MOVE] = 3; break; }
    };
    return this.build_schematic(hash);
}

Room.prototype.build_schematic = function(hash) {
    var schematic = [];
    for (var part in hash) {
        for (var i=0; i<hash[part]; i++) { schematic.push(part); }
    }
    return schematic;
}

    // Room.createCreep()
    // Pick the spawner with most energy
Room.prototype.createCreep = function(body, name, memory) {
    if (this.spawns.length > 0) {
        var spawn = this.spawns.sort( function(a,b) { return b.energy - a.energy; } )[0];
        if (spawn.busy == true || spawn.spawning) { return ERR_BUSY; }
        var result = spawn.canCreateCreep(body, name);
        if (result == OK) {
            memory['spawned'] = Game.time;
            memory['spawn'] = spawn.id;
            result = spawn.createCreep(body, name, memory);
            console.log(this.link()+' '+spawn+' spawning '+memory.class+' '+result);
            if (_.isString(result)) { result = OK; }
            if (result == OK) { spawn.busy = true; }
            return result;
        } else {
            return result;
        }
    } else {
        return ERR_NOT_FOUND;
    }
}

Room.prototype.want_drones = function() {
    // TODO: Calculate the optimal number of drones for this room
    //return (this.sources.length * 2) + 4; // Naive calculation
    var num = 2 + this.sources.length;
    if (this.construction_sites.length > 0) { num++; } // One extra for construction
    num += Math.floor(this.total_dropped_energy / 2000); // Energy on the floor means too few drones

    return num;
}


Room.prototype.execute = function() {
    for (var i=0; i<this.towers.length; i++) { this.towers[i].execute(); }
    for (var i=0; i<this.links.length; i++) { this.links[i].execute(); }
    for (var i=0; i<this.my_creeps.length; i++) { this.my_creeps[i].execute(); }
}

Room.prototype.can_colonize = function(roomname) {
    if (! Game.rooms[roomname]) { return false; } // No vision
    let room = Game.rooms[roomname];
    if (! room.controller) { return false; } // Room has no controller
    if (room.controller.my == true) { return false; }  // Room is already claimed by us
    if (! room.controller.reservation) { return true; } // Unreserved
    if (room.controller.reservation.username == this.controller.owner.username) { return true; } // Reserved by us
    return false;
}

Room.prototype.calc_energy_reserves = function() {
    if (this.energy_reserves) { return this.energy_reserves; }
    var count = this.containers.length;
    var total = 0;
    var total_capacity = 0;
    for (var i=0; i<count; i++) {
        total += this.containers[i].store.energy;
        total_capacity += this.containers[i].storeCapacity;
    }
    if (count > 0) {
        var percent = total * 100 / total_capacity;
        this.energy_reserves = percent;
        console.log(this.link()+' energy reserves at '+percent.toFixed(1)+'%');
        return percent;
    } else {
        return 0;
    }
}

Room.prototype.calc_spawn_reserves = function() {
    if (this.spawn_reserves) { return this.spawn_reserves; }
    var count = this.extensions.length;
    var total = 0;
    var total_capacity = 0;
    for (var i=0; i<count; i++) {
        total += this.extensions[i].energy;
        total_capacity += this.extensions[i].energyCapacity;
    }
    count = this.spawns.length;
    for (var i=0; i<count; i++) {
        total += this.spawns[i].energy;
        total_capacity += this.spawns[i].energyCapacity;
    }
    if (total_capacity > 0) {
        var percent = total * 100 / total_capacity;
        this.spawn_reserves = percent;
        //console.log(this.link()+' spawn reserves at '+percent.toFixed(1)+'%');
        return percent;
    } else {
        return 0;
    }
}

Room.prototype.consider_road = function(creep) {
    // creep.fatigue, creep.pos => construct road?
    if (this.under_attack() == true) { return; }
    creep.say('Road?');
    if (this.construction_sites.length > 2) { return; } // Throttle construction work
    var coord = creep.pos.x + ',' + creep.pos.y;
    var votes = this.memory.votes || {};
    //console.log(this.link()+' vote sheet before: '+JSON.stringify(votes));
    votes[coord] = (votes[coord] + creep.fatigue) || creep.fatigue; // Count vote
    //console.log(this.link()+' vote sheet after: '+JSON.stringify(votes));
    if (votes[coord] > this.roads.length) {
        votes = {}; // Reset vote sheet
        //console.log(this.link()+' build road at '+coord+' (have '+this.roads.length+')');
        this.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_ROAD);
    } else {
        //console.log(this.link()+' received '+votes[coord]+' votes for a road at '+coord+' (need '+this.roads.length+')');
    }
    this.memory.votes = votes; // Commit to memory
}

Room.prototype.assign_task_attack = function(biters) {
    while (biters.length > 0) {
        var biter = biters.shift();
        if (this.hostile_creeps.length > 0) {
            // Priority 1: Target nearest threat
            var candidates = this.hostile_creeps.slice();
            while (candidates.length > 0) {
                var candidate = biter.shift_nearest(candidates);
                if (!candidate.is_harmless()) {
                    biter.task = 'attack';
                    biter.target = candidate.id;
                    break;
                }
            }
            if (!biter.task) {
                // Priority 2: Target nearest harmless hostile
                var candidates = this.hostile_creeps.slice();
                var candidate = biter.shift_nearest(candidates);
                biter.task = 'attack';
                biter.target = candidate.id;
            }
        } else {
            // Find nearest spawn and recycle there
            var spawn = biter.shift_nearest(this.spawns.slice());
            biter.task = 'recycle';
            biter.target = spawn.id;
        }

    }
}

Room.prototype.assign_task_ranged_attack = function(spitters) {
    while (spitters.length > 0) {
        var spitter = spitters.shift();
        if (this.hostile_creeps.length > 0) {
            // Priority 1: Target nearest threat
            var candidates = this.hostile_creeps.slice();
            while (candidates.length > 0) {
                var candidate = spitter.shift_nearest(candidates);
                if (!candidate.is_harmless()) {
                    spitter.task = 'ranged attack';
                    spitter.target = candidate.id;
                    break;
                }
            }
            if (!spitter.task) {
                // Priority 2: Target nearest harmless hostile
                var candidates = this.hostile_creeps.slice();
                var candidate = spitter.shift_nearest(candidates);
                spitter.task = 'ranged attack';
                spitter.target = candidate.id;
            }
        } else {
            // Find nearest spawn and recycle there
            var spawn = spitter.shift_nearest(this.spawns.slice());
            spitter.task = 'recycle';
            spitter.target = spawn.id;
        }

    }
}

Room.prototype.assign_task_hunt = function(hunters) {
    while (hunters.length > 0) {
        var hunter = hunters.shift();
        hunter.task = 'hunt';
        hunter.target = hunter.id; // Dummy target
    }
}

Room.prototype.assign_task_travel = function(swarmers) {
    while (swarmers.length > 0) {
        var swarmer = swarmers.shift();
        if (swarmer.memory.destination == this.name) {
            swarmer.memory.class = 'Infector';
            delete swarmer.memory.destination;
        } else {
            swarmer.task = 'travel';
            swarmer.target = swarmer.id; // Dummy target
        }
    }
}

Room.prototype.assign_task_claim = function(infectors) {
    while (infectors.length > 0) {
        var infector = infectors.shift();
        infector.say('I infect!');
        if (this.controller) {
            if (this.controller.my == true) {
                infector.say('Victory!');
                infector.memory.class = 'Drone';
            } else {
                infector.say('I can haz');
                infector.task = 'claim';
                infector.target = this.controller.id;
            }
        }
    }
}

Room.prototype.assign_task_mine = function(miners) {
    while (miners.length > 0) {
        var miner = miners.shift();
        miner.task = 'mine';
        miner.target = miner.id; // Dummy because flag doesn't have an id. Duh.
        //console.log(miner.name+' assigned to '+miner.task+' '+miner.target);
    }
}

Room.prototype.assign_task_dismantle = function(dismantlers) {
    while (dismantlers.length > 0) {
        var dismantler = dismantlers.shift();
        dismantler.task = 'dismantle';
        dismantler.target = dismantler.id; // Dummy because flag doesn't have an id. Duh.
        //console.log(dismantler.name+' assigned to '+dismantler.task+' '+dismantler.target);
    }
}

Room.prototype.assign_task_extract = function(extractors) {
    while (extractors.length > 0) {
        var extractor = extractors.shift();
        extractor.task = 'extract';
        extractor.target = extractor.id; // Dummy because flag doesn't have an id. Duh.
        //console.log(extractor.name+' assigned to '+extractor.task+' '+extractor.target);
    }
}

Room.prototype.assign_task_reserve = function(reservers) {
    while (reservers.length > 0) {
        var reserver = reservers.shift();
        reserver.task = 'reserve';
        reserver.target = reserver.id; // Dummy because flag doesn't have an id. Duh.
        //console.log(reserver.name+' assigned to '+reserver.task+' '+reserver.target);
    }
}

Room.prototype.assign_task_remote_fetch = function(fetchers) {
    while (fetchers.length > 0) {
        var fetcher = fetchers.shift();
        fetcher.task = 'remote fetch';
        fetcher.target = fetcher.id; // Dummy because flag doesn't have an id. Duh.
        //console.log(fetcher.name+' assigned to '+fetcher.task+' '+fetcher.target);
    }
}

Room.prototype.assign_task_controller = function(drones) {
    if (drones.length > 0 && this.controller && this.controller.my && this.controller.ticksToDowngrade < 2000) {
        var drone = drones.shift();
        drone.task = 'upgrade';
        drone.target = this.controller.id;
        //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
    }
}

Room.prototype.assign_task_feed_spawn = function(drones, spawns) {
    while (drones.length > 0 && spawns.length > 0) {
        var drone = drones.shift();
        while (spawns.length > 0) {
            var spawn = drone.shift_nearest(spawns);
            if (spawn.energy < spawn.energyCapacity) {
                drone.task = 'feed spawn';
                drone.target = spawn.id;
                //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
                break;
            }
        }
        if (typeof drone.task == 'undefined') {
            // No spawns need energy
            drones.push(drone);
            break;
        }
    }
}

Room.prototype.assign_task_feed_tower = function(drones, towers) {
    while (drones.length > 0 && towers.length > 0) {
        var drone = drones.shift();
        while (towers.length > 0) {
            var tower = drone.shift_nearest(towers);
            if (tower.energy_pct < 95) {
                drone.task = 'feed tower';
                drone.target = tower.id;
                //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
                tower.assigned = (tower.assigned +1) || 1;
                if (tower.energy_pct < 75 && tower.assigned < 2) { towers.push(tower); } // Get one more drone (want 2)
                if (tower.energy_pct < 50 && tower.assigned < 3) { towers.push(tower); } // Get one more drone (want 3)
                if (tower.energy_pct < 25 && tower.assigned < 4) { towers.push(tower); } // Get one more drone (want 4)
                break;
            }
        }
        if (typeof drone.task == 'undefined') {
            // No towers need energy
            drones.push(drone);
            break;
        }
    }
}

Room.prototype.assign_task_feed_link = function(drones, links) {
    while (drones.length > 0 && links.length > 0) {
        var drone = drones.shift();
        if (links.length > 0) {
            var link = drone.shift_nearest(links);
            if (this.link_average < link.energyCapacity / 4) {
                // Link network needs energy, we just need the closest link
                drone.task = 'feed link';
                drone.target = link.id; // Will switch whenever needed
                //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
                return;
            }
        }
        if (typeof drone.task == 'undefined') {
            // Nearest link does not need energy
            drones.push(drone);
            break;
        }
    }
}

Room.prototype.assign_task_pick_up = function(drones, drops) {
    while (drones.length > 0 && drops.length > 0) {
        var drone = drones.shift();
        var loot = drone.shift_nearest(drops);
        drone.task = 'pick up';
        drone.target = loot.id;
        if (drone.memory.debug) { console.log(this.link()+' '+drone.name+' assigned to '+drone.task+' '+loot); }
    }
}

Room.prototype.assign_task_feed_extension = function(drones, extensions) {
    var count = 0;
    extensions = _.filter(extensions, function(e) { return e.energy < e.energyCapacity; } );
    //console.log(this.link()+' extensions that need energy: '+extensions.length);
    while (drones.length > 0 && extensions.length > 0 && count < 3) {
        var drone = drones.shift();
        var extension = drone.shift_nearest(extensions);
        drone.task = 'feed extension';
        drone.target = extension.id;
        count++;
        //console.log(this.link()+' '+drone.name+' assigned to '+drone.task+' '+extension);
        //drone.say('!!!');
    }
}

Room.prototype.assign_task_repair = function(drones, need_repairs){
    while (drones.length > 0 && need_repairs.length > 0) {
        var drone = drones.shift();
        //console.log(this.link()+' shifted '+drone.name+' off the stack');
        var structure = drone.shift_nearest(need_repairs);
        if (structure.structureType == STRUCTURE_WALL && structure.hits >= this.hp_ambition()) {
            //console.log(this.name+' pushed back on the stack');
            drones.push(drone);
            continue;
        }
        drone.task = 'repair';
        drone.target = structure.id;
        //console.log(this.link()+' '+drone.name+' assigned to '+drone.task+' '+drone.target);
        if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART) {
            need_repairs = [];
            return;
        } // Only one
        //console.log('outer loop end');
    }
}

Room.prototype.assign_task_build = function(drones, csites) {
    if (this.under_attack() == true) { return; }
    while (drones.length > 0 && csites.length > 0) {
        var drone = drones.shift();
        var csite = drone.shift_nearest(csites);
        drone.task = 'build';
        drone.target = csite.id;
        if (csite.structureType == STRUCTURE_SPAWN && this.spawns.length == 0) {
            csites.push(csite); // Emergency! Throw all remaining creeps on this task
        }

        //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
    }
}

Room.prototype.assign_task_stockpile = function(drones, storage) {
    //console.log(this.link()+' stockpile assignments: ('+drones.length+' drones available)');
    if (storage == null) { return; }
    var need = 1;
    if (storage.energy_pct < 50) { need = 2; }
    if (storage.energy_pct < 20) { need = 3; }
    var count = 0;
    while (drones.length > 0 && storage && count < need) {
        count++;
        var drone = drones.shift();
        if (storage.free > 0) {
            drone.task = 'stockpile';
            drone.target = storage.id;
            //console.log(drone.room+' '+drone.name+' assigned to '+drone.task+' '+storage+' ('+storage.energy+' energy, '+storage.energy_pct+'%)');
            continue;
        }
        if (typeof drone.task == 'undefined') {
            // No containers need energy
            drones.push(drone);
            break;
        }
    }
}

Room.prototype.assign_task_feed_terminal = function(drones, terminal) {
    //console.log(this.link()+' stockpile assignments: ('+drones.length+' drones available)');
    if (this.terminal == null) { return; }
    if (this.terminal.energy >= 10000) { return; }
    if (this.terminal.free < 10000) { return; }
    if (drones.length > 0) {
        var drone = drones.shift();
        if (terminal.free > 0) {
            drone.task = 'feed terminal';
            drone.target = terminal.id;
            //console.log(drone.room+' '+drone.name+' assigned to '+drone.task+' '+storage+' ('+storage.energy+' energy, '+storage.energy_pct+'%)');
            return;
        }
        if (typeof drone.task == 'undefined') {
            // No containers need energy
            drones.push(drone);
            return;
        }
    }
}

Room.prototype.assign_task_recycle = function(drones) {
    while (drones.length > 0) {
        var drone = drones.shift();
        drone.task = 'recycle';
        //var source = Math.floor(Math.random() * this.sources.length);
        //drone.target = this.sources[source].id;
        var spawn = drone.shift_nearest(this.spawns.slice());
        drone.target = spawn.id;
    }
}

Room.prototype.assign_task_upgrade = function(drones) {
    if (this.under_attack() == true) { return; }
    while (drones.length > 0 && this.controller && this.controller.my) {
        var drone = drones.shift();
        drone.task = 'upgrade';
        drone.target = this.controller.id;
        //console.log(drone.room.link()+' '+drone.memory.class+' '+drone.name+' assigned to '+drone.task+' '+drone.target);
    }
}

/*Room.prototype.load_routing_table = function(tile) {
    if (!this.memory.r) { this.memory.r = {}; }
    if (!this.memory.r[tile]) { this.memory.r[tile] = {}; }
    this.memory.r[tile]['mru'] = Game.time;
    var table = new Routingtable(this.memory.r[tile]['table']);
    return table;
}*/

/*Room.prototype.save_routing_table = function(tile, table) {
    if (!this.memory.r) { this.memory.r = {}; }
    if (!this.memory.r[tile]) { this.memory.r[tile] = {}; }
    this.memory.r[tile]['mru'] = Game.time;
    this.memory.r[tile]['table'] = table.asBinaryString();
}*/

/*Room.prototype.get_direction = function(src, dst) {
    var pos1 = ('0'+src.x).slice(-2) + ('0'+src.y).slice(-2); // Format as XXYY
    //var pos2 = ('0'+dst.x).slice(-2) + ('0'+dst.y).slice(-2); // Format as XXYY
    //console.log('???:'+pos1+'-'+pos2);
    if (!this.memory.r) { return null; }
    if (!this.memory.r[pos1]) { return null; }
    //if (!this.memory.router[pos1][pos2]) { return null; }
    //var direction = this.memory.router[pos1][pos2];
    this.memory.r[pos1]['mru'] = Game.time;
    var table = new Routingtable(this.memory.r[pos1]['table']);
    var direction = table.getDirectionTo(dst.x + (50 * dst.y));
    //console.log('HIT:'+pos1+'='+direction);
    return direction;
}*/

Room.prototype.expire_routes = function() {
    delete this.memory.router;
    if (this.memory.r) {
      var count = 0;
        var maxage = 1200; // Drop routing table for tiles not visited in 'maxage' ticks
        var tiles = Object.keys(this.memory.r);
        for (var i=0; i<tiles.length; i++) {
            var mru = this.memory.r[tiles[i]]['mru'];
            var age = Game.time - mru;
            if (age > maxage) {
                //console.log(this.link()+' tile '+tiles[i]+' mru='+mru+' age='+age+' maxage='+maxage);
                delete this.memory.r[tiles[i]];
                count++;
            }
        }
        //console.log(this.link()+' binary route(s) expired: '+count);
    }
}

Room.prototype.hp_ambition = function() {
    if (this.controller && this.controller.my) {
        var level = this.controller.level + (this.controller.progress / this.controller.progressTotal).toFixed(1) * 1;
        var hp = 25000 * level;
        //var hp = Math.floor(2000 * Math.exp(level+1));
        if (level == 8 && this.storage && this.storage.energy_pct >= 50) { hp = WALL_HITS_MAX; }
        return hp;
    } else {
        return 0;
    }
}

Room.prototype.start_timer = function(name) {
    this.timer[name] = Game.cpu.getUsed();
}

Room.prototype.stop_timer = function(name) {
    var delta = Game.cpu.getUsed() - this.timer[name];
    this.total[name] = (this.total[name] +  delta) || delta;
}

Room.prototype.show_totals = function() {
    var report = this.link()+' totals:';
    for (var name in this.total) { report = report+' '+name+'='+this.total[name].toFixed(3); }
    console.log(report);
}

/*Room.prototype.direction_to_room = function(name) {
    var direction = this.memory.to[name];
    if (direction != null) {
        //console.log(this.link()+' used room route cache entry for '+name);
        return direction;
    }
    // Fall back to Map.findRoute()
    console.log(this.link()+' (re)calculating route to '+name);
    this.start_timer('findRoute');
    var route = Game.map.findRoute(this.name, name, {
        routeCallback(rname) {
            if (Game.rooms[rname] && Game.rooms[rname].controller && Game.rooms[rname].controller.my) { return 1; } // My room
            var parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(rname);
            if ((parsed[1] % 10 === 0) || (parsed[2] % 10 === 0)) { return 1.5; } // Highway
            return 2.5;
        }
    });
    this.stop_timer('findRoute');
    this.memory.to[name] = route[0].exit;
    return route[0].exit;
}*/

Room.prototype.find_roads = function() {
    var start = null;
    var objects = this.recall('roads');
    if (objects == null || Math.random() < 0.05) {
        // If empty, do a manual scan. Also, 5% chance to discard cache and do a rescan.
        objects = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_ROAD; } });
        this.remember(objects, 'roads');
        //console.log(this.link()+' roads scanned');
    }
    return objects;
}

Room.prototype.find_walls = function() {
    var start = null;
    var objects = this.recall('walls');
    if (objects == null || Math.random() < 0.05) {
        // If empty, do a manual scan. Also, 5% chance to discard cache and do a rescan.
        objects = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_WALL; } });
        this.remember(objects, 'walls');
        //console.log(this.link()+' walls scanned');
    }
    return objects;
}

Room.prototype.find_extensions = function() {
    var start = null;
    var objects = this.recall('extensions');
    if (objects == null || Math.random() < 0.05) {
        // If empty, do a manual scan. Also, 5% chance to discard cache and do a rescan.
        objects = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_EXTENSION; } });
        this.remember(objects, 'extensions');
        //console.log(this.link()+' extensions scanned');
    }
    return objects;
}

Room.prototype.remember = function(objects, label) {
    var list = [];
    for (var i=0; i<objects.length; i++) { list.push(objects[i].id); }
    this.memory[label] = list.join(',');
}

Room.prototype.recall = function(label) {
    var objects = [];
    var string = this.memory[label];
    if (string == null) { return null; }
    //console.log('string='+string);
    var list = string.split(',');
    //console.log('list='+list.join(';'));
    for (var i=0; i<list.length; i++) {
        var object = Game.getObjectById(list[i]);
        if (object != null) { objects.push(object); }
        //console.log('  i='+i+' object='+object);
    }
    //console.log(this.link()+' recalled '+label+':'+objects.length);
    return objects;
}

Room.prototype.trade = function() {
    if (this.terminal == null) { return; }

    // Passive market orders
    // Consider selling to meet target
    for (var resource in this.terminal.store) {
        //console.log(this.link()+' terminal has '+this.terminal.store[resource]+' units of '+resource+', target is '+Game.market_targets[resource]);
        let sell_amount = this.terminal.store[resource] - Game.market_targets[resource];
        if (sell_amount > 100) {
            // Try to sell
            //console.log(this.link()+' wants to sell '+sell_amount+' '+resource+' to meet target');
            let orders = this.my_orders( { type: ORDER_SELL, resourceType: resource } );
            if (orders.length == 0) {
                let price = (Game.market_price[resource] || 1) * 1.15; // Offer at 15% above market average
                //console.log(this.link()+' create order type='+ORDER_SELL+' resourceType='+resource+' price='+price+' totalAmount='+sell_amount+' roomName='+this.name);
                let result = Game.market.createOrder(ORDER_SELL, resource, price, sell_amount, this.name);
                //console.log(this.link()+' create order result='+result);
            }
        }
    }

    // Passive market orders
    // Consider buying to meet target
    for (var resource in Game.market_targets) {
        //console.log(this.link()+' terminal has '+this.terminal.store[resource]+' units of '+resource+', target is '+Game.market_targets[resource]);
        let buy_amount = Game.market_targets[resource] - this.terminal.store[resource];
        if (buy_amount > 100) {
            // Try to buy
            //console.log(this.link()+' wants to buy '+buy_amount+' '+resource+' to meet target');
            let orders = this.my_orders( { type: ORDER_BUY, resourceType: resource } );
            if (orders.length == 0) {
                let price = (Game.market_price[resource] || 1) * 1.01; // Bid 1% above market average
                //console.log(this.link()+' create order type='+ORDER_BUY+' resourceType='+resource+' price='+price+' totalAmount='+buy_amount+' roomName='+this.name);
                let result = Game.market.createOrder(ORDER_BUY, resource, price, buy_amount, this.name);
                //console.log(this.link()+' create order result='+result);
            }
        }
    }

    // React to new buy/sell orders that match our targets and meet them if profit is >= 0
    for (var i in Game.new_orders) {
        let offer = Game.new_orders[i];
        console.log(this.link()+' NEW order: '+JSON.stringify(offer));
        // Sample: {"created":13735039,"type":"sell","amount":50000,"remainingAmount":50000,"resourceType":"L","price":5,"roomName":"E0N30","id":"57dd0f73ed387dbb429df4d9"}

        // Is this a buy order for something we would like to sell?
        if (offer.type == ORDER_BUY) {
            let sell_amount = this.terminal.store[offer.resourceType] - Game.market_targets[offer.resourceType];
            if (sell_amount > 0) {
                console.log(this.link()+' consider selling '+offer.resourceType+' at '+offer.price+' Cr/unit to meet order '+offer.id);
                let amount = Math.min(offer.remainingAmount, sell_amount, 1000);
                let energy = Game.market.calcTransactionCost(amount, this.name, offer.roomName);
                console.log('  transferring '+amount+' units to '+offer.roomName+' costs '+energy+' energy');
                let margin = offer.price - (Game.market_price[offer.resourceType] || 1);
                let total = offer.price * amount;
                console.log('  total: '+total+' Cr');
                let profit = (margin * amount) - (energy * (Game.market_price[RESOURCE_ENERGY] || 1));
                console.log('  '+this.link()+' has '+Game.market.credits+' Cr and '+this.terminal.store.energy+' units of energy');
                if (profit >= 0) {
                    console.log('  margin: '+margin+' estimated PROFIT: '+profit+' Cr');
                    let result = Game.market.deal(offer.id, amount, this.name);
                    console.log('  deal result='+result);
                } else {
                    console.log('  margin: '+margin+' estimated LOSS: '+profit+' Cr');
                }
            }
        }

        // Is this a sell order for something we would like to buy?
        if (offer.type == ORDER_SELL) {
            let buy_amount = Game.market_targets[offer.resourceType] - this.terminal.store[offer.resourceType];
            if (buy_amount > 0) {
                console.log(this.link()+' consider buying '+offer.resourceType+' at '+offer.price+' Cr/unit to meet order '+offer.id);
                let amount = Math.min(offer.remainingAmount, buy_amount, 1000);
                let energy = Game.market.calcTransactionCost(amount, offer.roomName, this.name);
                console.log('  transferring '+amount+' units from '+offer.roomName+' costs '+energy+' energy');
                let margin = (Game.market_price[offer.resourceType] || 1) - offer.price;
                let total = offer.price * amount;
                console.log('  total: '+total+' Cr');
                let profit = (margin * amount) - (energy * (Game.market_price[RESOURCE_ENERGY] || 1));
                console.log('  '+this.link()+' has '+Game.market.credits+' Cr and '+this.terminal.store.energy+' units of energy');
                if (profit >= 0) {
                    console.log('  margin: '+margin+' estimated PROFIT: '+profit+' Cr');
                    let result = Game.market.deal(offer.id, amount, this.name);
                    console.log('  deal result='+result);
                } else {
                    console.log('  margin: '+margin+' estimated LOSS: '+profit+' Cr');
                }
            }
        }
    }

    // Active speculation
    // For this to work, we need to consider the following for each resource:
    // - credit balance
    // - available storage space vs. current inventory
    // - available energy to move commodities
    // - time since last movement (liquidate and accept loss?)
    // - purchase price vs. historic market price vs. current offers (buy/hold/sell?)
    // TBD

}

Room.prototype.my_orders = function(filter) {
    // Filter my market orders for this room
    filter['roomName'] = this.name;
    return _.filter(Game.market.orders, filter );
}
