
var Routingtable = require('Routingtable');

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.my_creeps = this.find(FIND_MY_CREEPS);
        this.my_creeps = this.my_creeps.sort( function(a,b) { return a.ticksToLive - b.ticksToLive; } );
        this.hostile_creeps = this.find(FIND_HOSTILE_CREEPS);
        this.dropped_energy = this.find(FIND_DROPPED_ENERGY);
        this.dropped_other = this.find(FIND_DROPPED_RESOURCES, { filter: function(r) { return r.resourceType != RESOURCE_ENERGY; } });
        this.sources = this.find(FIND_SOURCES);
        this.spawns = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_SPAWN; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
        this.towers = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_TOWER; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
        this.roads = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_ROAD; } });
        this.links = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_LINK; } });
        this.extensions = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_EXTENSION; } }).sort( function(a,b) { return a.energy - b.energy; } ); // Least energy first
        this.containers = this.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE; } });
        this.construction_sites = this.find(FIND_CONSTRUCTION_SITES).sort( function(a,b) { return b.progress - a.progress; } ); // Nearest completion first
        var ambition = this.hp_ambition();
        this.need_repairs = this.find(FIND_STRUCTURES, { filter: function(s) { return s.hits && s.hits < ambition && s.hits < s.hitsMax; } }).sort( function(a,b) { return a.hits - b.hits; } ); // Most urgent first

        this.link_count = 0;
        this.link_total = 0;
        this.link_average = 0;

        // Owned controller? There should be a flag on it coordinating the upgrading efforts
        if (this.controller && this.controller.my && this.flag == null) {
            var flagname = 'controller '+this.name;
            this.createFlag(this.controller.pos, flagname);
            Memory.flags[flagname].controller = this.controller.id;
        }

        // Request reinforcements if room is owned but has no spawn
        if (this.controller && this.controller.my && this.spawns.length == 0 && this.my_creeps.length < 10) {
            Game.request_drones = this.name;
        }

        // Check if dedicated upgrader is alive
        if (this.memory.upgrader != null) {
            var creep = Game.getObjectById(this.memory.upgrader);
            if (creep != null && creep.memory.working == true && creep.memory.task.type == 'upgrade') {
            } else {
                this.memory.upgrader = null;
            }
        }

        for (var i=0; i<this.links.length; i++) { this.links[i].initialize(); }
        for (var i=0; i<this.my_creeps.length; i++) { this.my_creeps[i].initialize(); }
        for (var i=0; i<this.towers.length; i++) { this.towers[i].initialize(); }
        for (var i=0; i<this.sources.length; i++) { this.sources[i].initialize(); }
        for (var i=0; i<this.spawns.length; i++) { this.spawns[i].initialize(); }
        for (var i=0; i<this.containers.length; i++) { this.containers[i].initialize(); } // Note: Includes storage

        this.containers = this.containers.sort( function(a,b) { return a.free - b.free; } ); // Note: Must initialize before sorting

    },

    repairable: function() {
        return this.find(FIND_STRUCTURES, { filter: function(s) { return s.hits != undefined && s.hits < s.hitsMax; } });
    },

    // Room.createCreep()
    // Pick the spawner with most energy
    createCreep: function(body, name, memory) {
        if (this.spawns.length > 0) {
            var spawn = this.spawns.sort( function(a,b) { return b.energy - a.energy; } )[0];
            if (spawn.busy == true || spawn.spawning) { return ERR_BUSY; }
            var result = spawn.canCreateCreep(body, name);
            if (result == OK) {
                result = spawn.createCreep(body, name, memory);
                console.log(this+' '+spawn+' spawn '+body+' result='+result);
                if (_.isString(result)) { result = OK; }
                if (result == OK) { spawn.busy = true; }
                return result;
            } else {
                return result;
            }
        } else {
            return ERR_NOT_FOUND;
        }
    },

    plan: function() {

        var sources = this.sources.slice();
        var spawns = this.spawns.slice();
        var towers = this.towers.slice();
        var links = this.links.slice();
        var drops = this.dropped_other.slice();
        var extensions = this.extensions.slice(0,2); // 3 with least energy
        var containers = this.containers.reverse().slice(0,2); // 3 with least energy
        var my_creeps = this.my_creeps.slice(); // All classes
        var hostile_creeps = this.hostile_creeps.slice();
        var csites = this.construction_sites.slice(0,2); // Max 3 at a time
        var need_repairs = this.need_repairs.slice(0,2); // Max 3 at a time

        var miners = [];        // Mine energy (in remote rooms for now)
        var fetchers = [];      // Fetch energy from remote mines
        var zealots = [];     // Camp next to controller and upgrade it
        var drones = [];        // Generic workers
        var swarmers = [];      // Move to remote room then mutate into Infectors
        var infectors = [];     // Claim controller then mutate into Drone
        var biters = [];        // Attack unit
        var spitters = [];      // Ranged attack unit

        // Sort creeps into classes
        for (var i in my_creeps) {
            var creep = my_creeps[i];
            if (typeof creep == 'object') {
                if (!creep.memory.class) { creep.memory.class = 'Drone'; console.log(this+' AMNESIAC '+creep+' assigned to Drone class'); }
                if (creep.memory.class == 'Miner') { miners.push(creep); }
                if (creep.memory.class == 'Fetcher') { fetchers.push(creep); }
                if (creep.memory.class == 'Upgrader') { creep.memory.class = 'Zealot'; } // TEMP
                if (creep.memory.class == 'Zealot') { zealots.push(creep); }
                if (creep.memory.class == 'Drone') { drones.push(creep); }
                if (creep.memory.class == 'Swarmer') { swarmers.push(creep); }
                if (creep.memory.class == 'Infector') { infectors.push(creep); }
                if (creep.memory.class == 'Biter') { biters.push(creep); }
                if (creep.memory.class == 'Spitter') { spitters.push(creep); }
            } else {
                console.log(this+' POSSIBLE SERVER ERROR: INVALID CREEP type='+(typeof creep)+' creep='+creep);
            }
        }

        // EXPERIMENTAL
        // If the room has miners but no drones, morph one miner into a drone. This drone will then stay at the source.
/*        if (drones.length == 0 && miners.length >= 1) {
            var creep = miners.shift();
            creep.memory.class = 'Drone';
            drones.push(creep);
            console.log(this+' morphed '+creep+' into a Drone');
        }*/

        // Biters swarm and attack threats. Recycle when no longer needed.
        this.assign_task_attack(biters);

        // Spitters swarm and attack threats. Recycle when no longer needed.
        this.assign_task_ranged_attack(spitters);

        // Swarmers? Send them in the right direction or morph into Infector
        this.assign_task_travel(swarmers);

        // Infectors? Use them to capture control point, then morph into Drone
        this.assign_task_claim(infectors);

        // Sources. The energy must flow. For each source, assign a drone.
        this.assign_task_mine(drones, sources);

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

        // Containers needs energy?
        this.assign_task_stockpile(drones, containers);

        // Zealots always upgrade
        this.assign_task_upgrade(zealots);

        // FINALLY: Any leftover drones? Upgrade
        this.assign_task_upgrade(drones);

        // Remote miners
        this.assign_task_remote_mine(miners);

        // Remote fetchers
        this.assign_task_remote_fetch(fetchers);


        // Under attack and we have no towers? Spawn biters and spitters and hope for the best
        if (this.hostile_creeps.length > 0 && this.towers.length == 0) {
            // Emergency, spawn biters and spitters
            if (Math.random() > 0.5) {
                var result = this.createCreep([MOVE,ATTACK], undefined, { class: 'Biter' });
            } else {
                var result = this.createCreep([MOVE,RANGED_ATTACK], undefined, { class: 'Spitter' });
            }
            return;
        };

        if (Game.time % Math.floor(CREEP_LIFE_TIME / this.want_drones()) == 0) {
            // Experimental clockwork spawning of drones

            // FIXME! Naive scaling code
            var result = ERR_NOT_ENOUGH_ENERGY;
            //if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,WORK,WORK,WORK,WORK,WORK], undefined, { class: 'Drone' }); }
            //if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,WORK,WORK,WORK,WORK], undefined, { class: 'Drone' }); }
            if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,WORK,WORK,WORK], undefined, { class: 'Drone' }); }
            if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([MOVE,MOVE,CARRY,CARRY,WORK,WORK], undefined, { class: 'Drone' }); }
            if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([MOVE,CARRY,WORK], undefined, { class: 'Drone' }); }
            //console.log(this+' spawn result='+result);
            return;
        }
        if (Game.colonize && Game.time % 50 == 0) {
            console.log(this+' spawning a creep to claim '+Game.colonize);
            var result = this.createCreep([MOVE,CARRY,WORK,CLAIM], undefined, { class: 'Swarmer', destination: Game.colonize });
            return;
        }
        if (Game.request_drones && Game.time % 50 == 0) {
            console.log(this+' spawning a creep to build spawn in '+Game.request_drones);
            var result = this.createCreep([MOVE,CARRY,WORK], undefined, { class: 'Swarmer', destination: Game.request_drones });
            return;
        }
        if (this.controller && this.controller.flag) {
            var flag = this.controller.flag;
            var needs = flag.needs();
            if (needs == 'Zealot') {
                console.log(this+' spawning a zealot for '+flag.pos.roomName);
                var result = this.createCreep([WORK,WORK,WORK,WORK,WORK,CARRY,MOVE], undefined, { class: 'Zealot', home: this.name, flag: flag.name } );
                if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Zealot', home: this.name, flag: flag.name } ); }
                if (result == OK) { flag.spawned('Zealot'); }
                return;
            }
        }
        if (this.harvest_flags) {
            //console.log(this+' has harvest flags to consider: '+this.harvest_flags);
            for (var i in this.harvest_flags) {
                var flag = this.harvest_flags[i];
                var needs = flag.needs();
                if (needs == 'Miner') {
                    console.log(this+' spawning a remote miner for '+flag.pos.roomName);
                    var result = this.createCreep([WORK,WORK,WORK,CARRY,MOVE], undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                    if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                    if (result == OK) { flag.spawned('Miner'); }
                    return;
                }
                if (needs == 'Fetcher') {
                    console.log(this+' spawning a remote fetcher for '+flag.pos.roomName);
                    var result = this.createCreep([WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE], undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                    if (result == ERR_NOT_ENOUGH_ENERGY) { result = this.createCreep([WORK,CARRY,MOVE], undefined, { class: 'Fetcher', home: this.name, mine: flag.pos.roomName, flag: flag.name } ); }
                    if (result == OK) { flag.spawned('Fetcher'); }
                    return;
                }
/*                if (flag.memory.ticks > flag.memory.frequency) {
                    // Time to spawn another Miner to work this flag
                    console.log(this+' spawning a remote miner for '+flag.pos.roomName);
                    var result = this.createCreep([MOVE,MOVE,CARRY,CARRY,WORK,WORK], undefined, { class: 'Miner', home: this.name, mine: flag.pos.roomName, flag: flag.name } );
                    if (result == OK) { flag.memory.ticks = 0; }
                    return;
                }*/
            }
        }

    },

    want_drones: function() {
        // TODO: Calculate the optimal number of drones for this room
        return (this.sources.length * 2) + 4; // Naive calculation
    },

    optimize: function() {
        // Swap tasks where it makes sense

        // Calculate each creep's range to target
        for (var i=0; i<this.my_creeps.length; i++) {
            this.my_creeps[i].range_to_target = this.my_creeps[i].pos.getRangeTo(Game.getObjectById(this.my_creeps[i].target));
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
                var catb = creep_a.pos.getRangeTo(target_b)
                var cbta = creep_b.pos.getRangeTo(target_a)
                if (cbta+1 < creep_b.range_to_target && catb+1 < creep_a.range_to_target) {
                    // Both would benefit
                    //console.log(this+' creeps '+creep_a+' ('+creep_a.range_to_target+'>'+catb+') and '+creep_b+' ('+creep_b.range_to_target+'>'+cbta+')  swapped targets');
                    var target = creep_a.target;
                    var task = creep_a.task;
                    creep_a.target = creep_b.target;
                    creep_a.task = creep_b.task;
                    creep_b.target = creep_a.target;
                    creep_b.task = creep_a.task;
                    creep_a.say('swap');
                    creep_b.say('swap');
                }
            }
        }
    },

    execute: function() {
        for (var i=0; i<this.towers.length; i++) { this.towers[i].execute(); }
        for (var i=0; i<this.links.length; i++) { this.links[i].execute(); }
        for (var i=0; i<this.my_creeps.length; i++) { this.my_creeps[i].execute(); }
    },

    energy_reserves: function() {
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
            console.log(this+' energy reserves at '+percent.toFixed(1)+'%');
            return percent;
        } else {
            return 0;
        }
    },

    spawn_reserves: function() {
        if (this.spawn_reserves) { return this.spawn_reserves; }
        var count = this.extensions.length;
        var total = 0;
        var total_capacity = 0;
        for (var i=0; i<count; i++) {
            total += this.extensions[i].energy;
            total_capacity += this.containers[i].energyCapacity;
        }
        count = this.spawns.length;
        for (var i=0; i<count; i++) {
            total += this.spawns[i].energy;
            total_capacity += this.spawns[i].energyCapacity;
        }
        if (total_capacity > 0) {
            var percent = total * 100 / total_capacity;
            this.spawn_reserves = percent;
            console.log(this+' spawn reserves at '+percent.toFixed(1)+'%');
            return percent;
        } else {
            return 0;
        }
    },

    consider_road: function(creep) {
        // creep.fatigue, creep.pos => construct road?
        creep.say('Road?');
        if (this.construction_sites.length > 2) { return; } // Throttle construction work
        var coord = creep.pos.x + ',' + creep.pos.y;
        var votes = this.memory.votes || {};
        //console.log(this+' vote sheet before: '+JSON.stringify(votes));
        votes[coord] = (votes[coord] + creep.fatigue) || creep.fatigue; // Count vote
        //console.log(this+' vote sheet after: '+JSON.stringify(votes));
        if (votes[coord] > this.roads.length) {
            votes = {}; // Reset vote sheet
            console.log(this+' build road at '+coord+' (have '+this.roads.length+')');
            this.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_ROAD);
        } else {
            //console.log(this+' received '+votes[coord]+' votes for a road at '+coord+' (need '+this.roads.length+')');
        }
        this.memory.votes = votes; // Commit to memory
    },

    assign_task_attack: function(biters) {
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
    },

    assign_task_ranged_attack: function(spitters) {
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
    },

    assign_task_travel: function(swarmers) {
        while (swarmers.length > 0) {
            var swarmer = swarmers.shift();
            if (swarmer.memory.destination == this.name) {
                swarmer.memory.class = 'Infector';
                delete swarmer.memory.destination;
                infectors.push(swarmer);
            } else {
                swarmer.task = 'travel';
                swarmer.target = swarmer.id; // Dummy target
            }
        }
    },

    assign_task_claim: function(infectors) {
        while (infectors.length > 0) {
            var infector = infectors.shift();
            if (this.controller && this.controller.my == false) {
                infector.task = 'claim';
                infector.target = this.controller.id;
            } else {
                infector.memory.class = 'Drone';
                drones.push(infector);
            }
        }
    },

    assign_task_mine: function(miners, sources) {
        while (miners.length > 0 && sources.length > 0) {
            var miner = miners.shift();
            var source = miner.shift_nearest(sources);
            miner.task = 'mine';
            miner.target = source.id;
            //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
            if (miners.length < 3) { break; } // Bootstrap/emergency
        }
    },

    assign_task_remote_mine: function(miners) {
        while (miners.length > 0) {
            var miner = miners.shift();
            miner.task = 'remote mine';
            miner.target = miner.id; // Dummy because flag doesn't have an id. Duh.
            //console.log(miner.name+' assigned to '+miner.task+' '+miner.target);
        }
    },

    assign_task_remote_fetch: function(fetchers) {
        while (fetchers.length > 0) {
            var fetcher = fetchers.shift();
            fetcher.task = 'remote fetch';
            fetcher.target = fetcher.id; // Dummy because flag doesn't have an id. Duh.
            //console.log(fetcher.name+' assigned to '+fetcher.task+' '+fetcher.target);
        }
    },

    assign_task_controller: function(drones) {
        if (drones.length > 0 && this.controller && this.controller.my && this.controller.ticksToDowngrade < 2000) {
            var drone = drones.shift();
            drone.task = 'upgrade';
            drone.target = this.controller.id;
            //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
        }
    },

    assign_task_feed_spawn: function(drones, spawns) {
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
    },

    assign_task_feed_tower: function(drones, towers) {
        while (drones.length > 0 && towers.length > 0) {
            var drone = drones.shift();
            while (towers.length > 0) {
                var tower = drone.shift_nearest(towers);
                if (tower.energy < tower.energyCapacity) {
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
    },

    assign_task_feed_link: function(drones, links) {
        while (drones.length > 0 && links.length > 0) {
            var drone = drones.shift();
            if (links.length > 0) {
                var link = drone.shift_nearest(links);
                if (this.link_average < link.energyCapacity / 2) {
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
    },

    assign_task_pick_up: function(drones, drops) {
        while (drones.length > 0 && drops.length > 0) {
            var drone = drones.shift();
            var loot = drone.shift_nearest(drops);
            drone.task = 'pick up';
            drone.target = loot.id;
            //console.log(drone.name+' assigned to '+drone.task+' '+loot);
        }
    },

    assign_task_feed_extension: function(drones, extensions) {
        while (drones.length > 0 && extensions.length > 0) {
            var drone = drones.shift();
            while (extensions.length > 0) {
                var extension = drone.shift_nearest(extensions);
                if (extension.energy < extension.energyCapacity) {
                    drone.task = 'feed extension';
                    drone.target = extension.id;
                    //console.log(drone.name+' assigned to '+drone.task+' '+extension);
                    break;
                }
            }
            //console.log(drone.room+' '+drone+' task '+drone.task);
            if (typeof drone.task == 'undefined') {
                // No extensions need energy
                drones.push(drone);
                break;
            }
        }
    },

    assign_task_repair: function(drones, need_repairs){
        while (drones.length > 0 && need_repairs.length > 0) {
            var drone = drones.shift();
            while (need_repairs.length > 0) {
                var structure = drone.shift_nearest(need_repairs);
                if (structure.structureType == STRUCTURE_WALL && structure.hits >= this.hp_ambition()) { continue; }
                drone.task = 'repair';
                drone.target = structure.id;
                //console.log(drone.name+' assigned to '+drone.task+' '+drone.target);
                if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART) {
                    need_repairs = [];
                    break;
                } // Only one
            }
            if (typeof drone.task == 'undefined') {
                // No structures need repair
                drones.push(drone);
                break;
            }
        }
    },

    assign_task_build: function(drones, csites) {
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
    },

    assign_task_stockpile: function(drones, containers) {
        //console.log(this+' container assignments:');
        while (drones.length > 0 && containers.length > 0) {
            var drone = drones.shift();
            while (containers.length > 0) {
                //var container = drone.shift_nearest(containers);
                var container = containers.shift();
                if (container.free > 0) {
                    drone.task = 'stockpile';
                    drone.target = container.id;
                    //console.log(drone.room+' '+drone.name+' assigned to '+drone.task+' '+container+' ('+container.energy+' energy)');
                    break;
                }
            }
            if (typeof drone.task == 'undefined') {
                // No containers need energy
                drones.push(drone);
                break;
            }
        }
    },

    assign_task_recycle: function(drones) {
        while (drones.length > 0) {
            var drone = drones.shift();
            drone.task = 'recycle';
            //var source = Math.floor(Math.random() * this.sources.length);
            //drone.target = this.sources[source].id;
            var spawn = drone.shift_nearest(this.spawns.slice());
            drone.target = spawn.id;
        }
    },

    assign_task_upgrade: function(drones) {
        while (drones.length > 0 && this.controller && this.controller.my) {
            var drone = drones.shift();
            drone.task = 'upgrade';
            drone.target = this.controller.id;
            console.log(drone.memory.class+' '+drone.name+' assigned to '+drone.task+' '+drone.target);
        }
    },

    load_routing_table: function(tile) {
        if (!this.memory.router) { this.memory.router = {}; }
        if (!this.memory.router[tile]) { this.memory.router[tile] = {}; }
        this.memory.router[tile]['mru'] = Game.time;
        var table = new Routingtable(this.memory.router[tile]['table']);
        return table;
    },

    save_routing_table: function(tile, table) {
        if (!this.memory.router) { this.memory.router = {}; }
        if (!this.memory.router[tile]) { this.memory.router[tile] = {}; }
        this.memory.router[tile]['table'] = table.asString();
    },

    /*
    set_direction: function(src, dst, direction) {
        var pos1 = ('0'+src.x).slice(-2) + ('0'+src.y).slice(-2); // Format as XXYY
        var pos2 = ('0'+dst.x).slice(-2) + ('0'+dst.y).slice(-2); // Format as XXYY
        if (!this.memory.router) { this.memory.router = {}; }
        if (!this.memory.router[pos1]) { this.memory.router[pos1] = {}; }
        var table = new Routingtable(this.memory.router[pos1]['table']);
        table.setDirectionTo(pos2, direction);
        this.memory.router[pos1]['table'] = table.asString();
        //console.log('-->:'+pos1+'-'+pos2+'='+direction);
        //this.memory.router[pos1][pos2] = direction;
        this.memory.router[pos1]['mru'] = Game.time;
    },
    */

    get_direction: function(src, dst) {
        var pos1 = ('0'+src.x).slice(-2) + ('0'+src.y).slice(-2); // Format as XXYY
        var pos2 = ('0'+dst.x).slice(-2) + ('0'+dst.y).slice(-2); // Format as XXYY
        //console.log('???:'+pos1+'-'+pos2);
        if (!this.memory.router) { return null; }
        if (!this.memory.router[pos1]) { return null; }
        //if (!this.memory.router[pos1][pos2]) { return null; }
        //var direction = this.memory.router[pos1][pos2];
        this.memory.router[pos1]['mru'] = Game.time;
        var table = new Routingtable(this.memory.router[pos1]['table']);
        var direction = table.getDirectionTo(pos2);
        //console.log('HIT:'+pos1+'-'+pos2+'='+direction);
        return direction;
    },

    expire_routes: function() {
        if (this.memory.router) {
          var count = 0;
            var maxage = Game.time - 900; // Drop routing table for tiles not visited in 'maxage' ticks
            var tiles = Object.keys(this.memory.router);
            for (var i=0; i<tiles.length; i++) {
                if (this.memory.router[tiles[i]]['mru'] < maxage) {
                    delete this.memory.router[tiles[i]];
                    count++;
                }
            }
            console.log(this+' routes expired: '+count);
        }
    },

    hp_ambition: function() {
        if (this.controller && this.controller.my) {
            var level = this.controller.level + (this.controller.progress / this.controller.progressTotal).toFixed(1) * 1;
            var hp = 25000 * level;
            return hp;
        } else {
            return 0;
        }
    },
};
