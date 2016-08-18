
module.exports = {}; // Nothing.

Creep.prototype.initialize = function() {
    //console.log(this+' initializing');
    if (!this.memory.working) { this.memory.working = false; }
    this.memory.age = (this.memory.age + 1) || 1;
    this.memory.where = this.room.name;
    this.free = this.carryCapacity - _.sum(this.carry);

    // Get an array of adjacent objects but be careful not to look outside x/y 0-49
    this.adjacent = this.room.lookAtArea(
        (this.pos.y > 0 ? this.pos.y-1 : this.pos.y),
        (this.pos.x > 0 ? this.pos.x-1 : this.pos.x),
        (this.pos.y < 49 ? this.pos.y+1 : this.pos.y),
        (this.pos.x < 49 ? this.pos.x+1 : this.pos.x),
        true // Result as plain array please
    );
    if (this.memory.debug) { console.log(this.adjacent); }
}

Creep.prototype.containers_within_reach = function() {
    var found = [];
    for (var i=0; i<this.adjacent.length; i++) {
        var object = this.adjacent[i];
        if (object.type == LOOK_STRUCTURES && object.structure.structureType == STRUCTURE_CONTAINER) {
            found.push(Game.getObjectById(object.structure.id)); // Note! Object is just a nested hash
        }
    }
    return found;
}

Creep.prototype.links_within_reach = function() {
    var found = [];
    for (var i=0; i<this.adjacent.length; i++) {
        var object = this.adjacent[i];
        if (object.type == LOOK_STRUCTURES && object.structure.structureType == STRUCTURE_LINK) {
            found.push(Game.getObjectById(object.structure.id)); // Note! Object is just a nested hash
        }
    }
    return found;
}

Creep.prototype.energy_within_reach = function() {
    var found = [];
    for (var i=0; i<this.adjacent.length; i++) {
        var object = this.adjacent[i];
        if (object.type == LOOK_RESOURCES && object.resource.resourceType == RESOURCE_ENERGY) {
            found.push(Game.getObjectById(object.resource.id)); // Note! Object is just a nested hash
        }
    }
    return found;
}

Creep.prototype.speak = function() {
    var comments = [ '*bzz*', '*chirp*', '*chirr*', '*chirrup*', '*chitter*', '*click*', '*clitter*', '*cricket*' ];
    this.say(comments[Math.floor(Math.random() * comments.length)], true);
}

Creep.prototype.execute = function() {

    if (Math.random() > 0.9) { this.speak(); }

    // Consider new roads
    if (this.fatigue > 0 && this.memory.tracking == true) { this.room.consider_road(this); }

    var target = Game.getObjectById(this.target);
    //console.log(this+' target '+target);
    if (target == null) {
        if (this.room.controller && (this.room.controller.level < 3 || (this.room.energy_reserves() > 25 && this.room.spawn_reserves() > 50))) {
            target = this.room.controller;
            this.task = 'upgrade';
            this.target = this.room.controller.id;
        } else {
            this.task = 'none';
            this.target = null;
        }
    }
    //console.log(this+' executing task: '+this.task+' '+(target || ''));
    //this.say(this.task);
    // For debugging, place task+target in memory as human readable strings
    // For sticky targeting we must keep track of how much time has been invested
    if (typeof this.memory.task == 'object' && this.memory.task.type == this.task && this.memory.task.target == target.toString()) {
        this.memory.task.ticks = (this.memory.task.ticks + 1) || 1;
    } else {
        var target_str = (target != null ? target.toString() || '(null)');
        this.memory.task = { type: this.task, target: target_str, ticks: 0 };
    }

    // Tasks that do not involve a work/fetch cycle
    if (this.task == 'hunt') { this.task_hunt(); return; }
    if (this.task == 'attack') { this.task_attack(); return; }
    if (this.task == 'ranged attack') { this.task_ranged_attack(); return; }
    if (this.task == 'recycle') { this.task_recycle(); return; }
    if (this.task == 'pick up') { this.task_pick_up(); return; }
    if (this.task == 'mine') { this.task_mine(); return; }
    if (this.task == 'remote fetch') { this.task_remote_fetch(); return; }
    if (this.task == 'claim') { this.task_claim(); return; }
    if (this.task == 'travel') { this.task_travel(); return; }
    if (this.task == 'upgrade') { this.task_upgrade(); return; }

    // Carrying something else than energy? Ignore task and store it somewhere!
    if (_.sum(this.carry) > this.carry.energy) {
        var target = this.shift_nearest(this.room.containers.splice());
        if (target != null) {
            if (this.pos.inRangeTo(target, 1)) {
                for (var cargo in this.carry) { this.transfer(target, cargo); break; }
                this.memory.tracking = false;

            } else {
                this.move_to(target);
                this.memory.tracking = false;
            }
            return;
        }
    }

    // Free energy within reach? Try to grab it.
    if (this.free > 0) {
        //var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
        var treasures = this.energy_within_reach();
        if (treasures.length > 0) {
            var reserved = treasures[0].reserved_amount || 0;
            if (treasures[0].amount > reserved) {
                treasures[0].reserved_amount = reserved + this.free;
                this.pickup(treasures[0]);
                this.say('Treasure');
                return;
            }
        }
    }

    // Get energy if needed
    if (this.memory.working == true && this.is_empty()) { this.memory.working = false; }
    if (this.memory.working == false && this.is_full()) { this.memory.working = true; }
    if (this.memory.working == false) { this.get_energy(); return; }

    // Tasks that consume energy
    if (this.task == 'feed spawn') { this.task_feed(); return; }
    if (this.task == 'feed link') { this.task_feed_link(); return; }
    if (this.task == 'feed tower') { this.task_feed(); return; }
    if (this.task == 'feed extension') { this.task_feed(); return; }
    if (this.task == 'stockpile') { this.task_feed(); return; }
    if (this.task == 'build') { this.task_build(); return; }
    if (this.task == 'repair') { this.task_repair(); return; }

    console.log(this.room+' '+this+' has unhandled task '+this.task);
}

Creep.prototype.get_energy = function() {

    // Consider energy dropped on the ground
    //console.log(this+' looking for energy on the ground');
    var all_dropped_energy = this.room.dropped_energy.slice();
    while (all_dropped_energy.length > 0) {
        var energy = this.shift_nearest(all_dropped_energy);
        if (energy instanceof Resource) {
            var reserved = energy.reserved_amount || 0;
            var wanted = this.carryCapacity - _.sum(this.carry);
            var available = energy.amount;
            if (available < reserved + wanted) { continue; } // Not enough left for me
            //console.log(this+' decided to pick up '+energy+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')');
            energy.reserved_amount = reserved + wanted;
            if (this.pos.inRangeTo(energy, 1)) {
                this.pickup(energy);
                this.memory.tracking = false;
            } else {
                //console.log(this+' moving to pick up '+energy);
                this.move_to(energy);
                this.memory.tracking = false;
            }
            return;
        }
    }

    // Consider fetching energy from a link
    //console.log(this+' considers fetching energy from a link');
    if (this.task == 'feed tower' || this.task == 'feed spawn' || this.task == 'feed extension') {
        var links = this.room.links.slice();
        while (links.length > 0) {
            var link = this.shift_nearest(links);
            if (link instanceof StructureLink) {
                var reserved = link.reserved_amount || 0;
                var wanted = this.carryCapacity - _.sum(this.carry);
                var available = link.energy;
                if (available < reserved + wanted) { continue; } // Not enough left for me
                //console.log(this+' decided to fetch from '+link+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')');
                link.reserved_amount = reserved + this.carryCapacity - _.sum(this.carry);
                if (this.pos.inRangeTo(link, 1)) {
                    this.withdraw(link, RESOURCE_ENERGY);
                    this.memory.tracking = true;
                } else {
                    this.move_to(link);
                    this.memory.tracking = false;
                }
                return;
            }
        }
    }

    // Consider fetching energy from a container
    //console.log(this+' considers fetching energy from a container');
    if (this.task != 'upgrade' && this.task != 'stockpile') {
        var containers = this.room.containers.slice();
        while (containers.length > 0) {
            var container = this.shift_nearest(containers);
            if (container instanceof StructureContainer) {
                var reserved = container.reserved_amount || 0;
                var wanted = this.carryCapacity - _.sum(this.carry);
                var available = container.store.energy;
                if (available < reserved + wanted) { continue; } // Not enough left for me
                //console.log(this+' decided to fetch from '+container+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')');
                container.reserved_amount = reserved + wanted;
                if (this.pos.inRangeTo(container, 1)) {
                    this.withdraw(container, RESOURCE_ENERGY);
                    this.memory.tracking = true;
                } else {
                    this.move_to(container);
                    this.memory.tracking = false;
                }
                return;
            }
        }
    }

    // Consider fetching energy from storage
    //console.log(this+' considers fetching energy from storage');
    if (this.task != 'upgrade' && this.task != 'stockpile') {
        var storage = this.room.storage;
        if (storage instanceof StructureStorage) {
            var reserved = storage.reserved_amount || 0;
            var wanted = this.carryCapacity - _.sum(this.carry);
            var available = storage.store.energy;
            if (available >= reserved + wanted) {
                //console.log(this+' decided to fetch from '+storage+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')');
                storage.reserved_amount = reserved + this.carryCapacity - _.sum(this.carry);
                if (this.pos.inRangeTo(storage, 1)) {
                    this.withdraw(storage, RESOURCE_ENERGY);
                    this.memory.tracking = true;
                } else {
                    this.move_to(storage);
                    this.memory.tracking = false;
                }
                return;
            }
        }
    }

    // Consider mining
    //console.log(this+' considers mining for energy');
    var sources = this.room.sources.slice();
    while (sources.length > 0) {
        var source = this.shift_nearest(sources);
        if (source instanceof Source) {
            var used_slots = source.used_slots || 0;
            var free_slots = source.slots.length - used_slots + 1; // Reserve space for one dedicated miner
            if (free_slots < 1) { continue; } // Not enough left for me
            source.used_slots = used_slots + 1;
            if (this.pos.inRangeTo(source, 1)) {
                this.harvest(source);
                this.memory.tracking = true;
            } else {
                this.move_to(source);
                this.memory.tracking = false;
            }
            return;
        }
    }
}

Creep.prototype.shift_nearest = function(targets) {
    var x = this.pos.x;
    var y = this.pos.y;
    //var targets_by_range = targets.sort( function(a,b) { return a.pos.getRangeTo(x,y) - b.pos.getRangeTo(x,y); } );
    var lo_range = null;
    var lo_index = null;
    for (var i=0; i<targets.length; i++) {
        var range = targets[i].pos.getRangeTo(x, y);
        if (lo_range == null || range < lo_range) {
            lo_range = range;
            lo_index = i;
            if (lo_range == 1) { break; } // Close enough
        }
    }
    if (lo_index == null) {
        //console.log('unable to find nearest in '+targets);
        return null;
    } else {
        var nearest = targets.splice(lo_index, 1);
        //console.log(this+' nearest target is '+nearest[0]+' at range '+lo_range);
        return nearest[0];
    }
    //return targets_by_range.shift();
}

Creep.prototype.is_full = function() {
    return (_.sum(this.carry) >= this.carryCapacity);
}

Creep.prototype.is_empty = function() {
    return (_.sum(this.carry) == 0);
}

Creep.prototype.is_harmless = function() {
    if (this.getActiveBodyparts(ATTACK) > 0) { return false; } // Can bite
    if (this.getActiveBodyparts(RANGED_ATTACK) > 0) { return false; } // Can shoot
    if (this.getActiveBodyparts(CLAIM) > 0) { return false; } // Can claim/reserve/attack controller
    if (this.getActiveBodyparts(WORK) > 0) { return false; } // Can dismantle
    if (this.getActiveBodyparts(HEAL) > 0) { return false; } // Can tank
    return true;
}

Creep.prototype.task_hunt = function() {
    this.memory.tracking = false;
    if (this.memory.destination == this.room.name) {
        //console.log(this.memory.class+' '+this+' hunting hostiles in '+this.room.name);
        // Attack!
        var target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (target != null) {
            if (this.pos.getRangeTo(target) > 1) {
                if (this.hits < this.hitsMax) { this.heal(this); }// Attempt to heal self
                this.move_to(target); // Close on target
            } else {
                this.attack(target);
            }
        }
    } else {
        console.log(this.memory.class+' '+this+' heading for '+this.memory.destination+' to assist');
        this.move_to({ pos: new RoomPosition(25, 25, this.memory.destination) });
    }
}

Creep.prototype.task_attack = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 1)) {
        this.attack(target);
        this.add_stats('attack')
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_ranged_attack = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 3)) {
        this.rangedAttack(target);
        this.add_stats('ranged attack')
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_recycle = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 1)) {
        if (this.carry.energy > 0) {
            this.transfer(target, RESOURCE_ENERGY);
        } else {
            target.recycleCreep(this);
        }
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_pick_up = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 1)) {
        this.pickup(target);
    } else {
        if (this.carry.energy) { this.drop(RESOURCE_ENERGY); } // Make room for valuables!
        this.move_to(target);
    }
    return;
}

Creep.prototype.remember = function(label, objects) {
    // Put a named list of object ids in memory
    var index = [];
    for (var i=0; i<objects.length; i++) { index.push(objects[i].id); }
    this.memory[label] = index;
}

Creep.prototype.recall = function(label) {
    // Get a named list of objects based on ids in memory
    var objects = [];
    var index = this.memory[label];
    //console.log(this+' recalling '+label+': '+index);
    for (var i=0; i<index.length; i++) {
        var object = Game.getObjectById(index[i]);
        //console.log('  id='+index[i]+' object='+object);
        if (object != null) { objects.push(object); }
    }
    return objects;
}

Creep.prototype.task_mine = function() {
    var flag = Game.flags[this.memory.flag];
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    // In the right room yet?
    if (this.room.name == this.memory.mine) {
        // Yes. Locate source at flag
        var found = this.room.lookForAt(LOOK_SOURCES, flag);
        var source = found[0];
        var arrived = this.memory.arrived || 0;
        if (source == null) { flag.remove(); return; } // User error
        if (arrived == 0 && this.pos.getRangeTo(source) > 1) {
            // Move closer
            this.move_to(source);
            //console.log('Miner '+this+' approaching source ('+source+' in '+this.memory.mine+')');
        } else {
            if (arrived == 0) {
                this.memory.arrived = Game.time;
            }
            // Get energy
            this.harvest(source);
            //console.log('Miner '+this+' harvesting source ('+source+' in '+this.memory.mine+')');

            // Link with free space within reach?
            var links = this.links_within_reach();
            //console.log(this+' can reach these links: '+links);
            var link = null;
            for (var i=0; i<links.length; i++) {
                //console.log(this+' consider putting energy in '+links[i]+' ('+links[i].free+' free)');
                if (links[i].free == 0) { continue; }
                link = links[i]
            }
            if (link != null) { this.transfer(link, RESOURCE_ENERGY); return; }

            // Container with free space within reach?
            var containers = this.containers_within_reach();
            //console.log(this+' can reach these containers: '+containers);
            var container = null;
            for (var i=0; i<containers.length; i++) {
                //console.log(this+' consider putting energy in '+containers[i]+' ('+containers[i].free+' free)');
                if (containers[i].free == 0) { continue; }
                container = containers[i]
            }
            if (container != null) { this.transfer(container, RESOURCE_ENERGY); return; }

            // Nope. Just drop the energy on the ground then
            this.drop(RESOURCE_ENERGY);

        }
        return;
    } else {
        // No. Try to reach the room marked with a flag.
        this.move_to(flag);
        //console.log('Miner '+this+' moving to flag ('+flag+' in '+this.memory.mine+')');
        return;
    }
}

Creep.prototype.task_remote_fetch = function() {
    var flag = Game.flags[this.memory.flag];
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    if (this.memory.working == true && this.is_empty()) { this.memory.working = false; }
    if (this.memory.working == false && this.is_full()) { this.memory.working = true; }
    if (this.memory.working == false) {
        // In the right room yet?
        if (this.room.name == this.memory.mine) {
            // Yes. Locate source at flag
            var found = this.room.lookForAt(LOOK_SOURCES, flag);
            var source = found[0];
            if (source == null) { flag.remove(); return; } // User error
            if (this.pos.getRangeTo(source) > 1) {
                // Move closer
                this.move_to(source);
                //console.log('Fetcher '+this+' approaching source ('+source+' in '+this.memory.mine+')');
            } else {
                // Get energy -- dedicated miner missing or behind schedule?
                this.harvest(source);
                //console.log('Fetcher '+this+' harvesting source ('+source+' in '+this.memory.mine+')');
            }
            // Dropped energy within reach? Grab it.
            //var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
            var treasures = this.energy_within_reach();
            if (treasures.length > 0) {
                this.pickup(treasures[0]);
            }
            return;
        } else {
            // No
            this.move_to(flag);
            //console.log('Fetcher '+this+' moving to flag ('+flag+' in '+this.memory.mine+')');
            return;
        }
    }
    if (this.memory.working == true) {
        var ctrl = Game.rooms[this.memory.home].controller;
        var upgrader = Game.rooms[this.memory.home].upgrader;
        var target = upgrader || ctrl;
        //console.log(this.room+' '+this+' ctrl='+ctrl+' upgrader='+upgrader+' target='+target);
        // In the right room yet?
        if (this.room.name == this.memory.home) {
            // Yes, approach upgrader (or controller if no upgrader is present)
            if (upgrader && this.pos.getRangeTo(target) <= 1) {
                this.drop(RESOURCE_ENERGY);
                //console.log('Fetcher '+this+' assisting ('+upgrader+' in '+this.memory.home+')');
                return;
            }
            if (this.pos.getRangeTo(target) > 1) {
                this.move_to(target);
                //console.log('Fetcher '+this+' approaching target ('+target+' in '+this.memory.home+')');
                //return;
            };
            if (ctrl && this.pos.getRangeTo(target) <= 3) {
                this.upgradeController(ctrl);
                //console.log('Fetcher '+this+' upgrading controller ('+ctrl+' in '+this.memory.home+')');
                return;
            }
            return;
        } else {
            // No
            this.move_to(ctrl);
            //console.log('Fetcher '+this+' fetching energy to '+this.memory.home+')');
            // Experimental: Road maintenance here?
            var structures = this.pos.lookFor(LOOK_STRUCTURES);
            for (var i in structures) {
                var s = structures[i];
                if (s.structureType == STRUCTURE_ROAD && s.hits < s.hitsMax) {
                    this.repair(s);
                    break;
                }
            }

            // Experimental: Road construction here?
            var csites = this.pos.lookFor(LOOK_CONSTRUCTION_SITES);
            for (var i in csites) {
                var cs = csites[i];
                if (cs.structureType == STRUCTURE_ROAD) {
                    this.build(cs);
                    break;
                }
            }

            return;
        }
    }
}

Creep.prototype.task_claim = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 1)) {
        this.claimController(target);
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_travel = function() {
    var result = this.move_to({ pos: new RoomPosition(25, 25, this.memory.destination)});
    this.memory.tracking = true;
    //console.log(this+' moveTo '+this.memory.destination+' result='+result);
    return;
}

Creep.prototype.task_feed = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = true;
    if (this.pos.inRangeTo(target, 1)) {
        this.transfer(target, RESOURCE_ENERGY);
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_feed_link = function() {
    var target = this.shift_nearest(this.room.links.slice()); // Always switch to nearest
    this.target = target.id;
    this.memory.tracking = true;
    if (this.pos.inRangeTo(target, 1)) {
        this.transfer(target, RESOURCE_ENERGY);
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_build = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 3)) {
        this.build(target);
        this.add_stats('build')
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_repair = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 3)) {
        this.repair(target)
        this.add_stats('repair')
    } else {
        this.move_to(target, { maxRooms: 0 }); // Stay in this room!
    }
    return;
}

Creep.prototype.task_upgrade = function() {
    var target = Game.getObjectById(this.target);
    var upgrader = Game.rooms[this.room.name].upgrader;
    var ctrl = Game.rooms[this.room.name].controller;
    var flag = Game.flags[this.memory.flag];
    if (flag != null) { flag.assign_worker(this); } // Check in with flag
    if (this.memory.class != 'Zealot') { target = upgrader || ctrl; }
    var range = this.pos.getRangeTo(target);
    this.memory.tracking = true;
    //console.log(this.memory.class+' '+this+' upgrade target ['+(target.structureType)+'] range ['+range+']');
    if (target.structureType == STRUCTURE_CONTROLLER && range <= 3) {
        //console.log('  ok, upgrade it');
        delete this.memory._move;
        delete this.memory.moving_to;
        if (this.carry.energy > 0) {
            //console.log(this+' has energy and should upgrade '+target);
            this.upgradeController(target);
            this.add_stats('upgrade');
            if (this.memory.class == 'Zealot') {
                this.say('Praise GCL!');
            }
        }
        if (this.memory.class == 'Zealot') {
            //console.log(this+' is the designated upgrader for '+this.room+' ('+this.id+')');
            this.room.memory.upgrader = this.id;
        }
        if (this.free > 0) {
            //console.log(this+' has free space');
            //var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
            var treasures = this.energy_within_reach();
            if (treasures.length > 0) { this.pickup(treasures[0]); }
        }
        return;
    }
    //console.log(this+' target: '+target);
    if (target.structureType != STRUCTURE_CONTROLLER && range <= 1) {
        if (target.free > 0) {
            this.transfer(target, RESOURCE_ENERGY);
        }
        if (this.pos.inRangeTo(ctrl, 3)) {
            this.upgradeController(ctrl);
            this.add_stats('upgrade');
        } else {
            this.move_to(ctrl);
        }
        return;
    }
    this.move_to(target);
    return;
}

Creep.prototype.direction_vector = function(direction) {
    var vec = [[0,0], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1] ];
    if (direction >= 1 && direction <= 8) { return vec[direction]; }
    try {
        console.log(this+' at '+this.pos+' got an INVALID direction_vector('+direction+')');
        console.log(arguments.callee.trace());
    }
    catch (e) {
        console.log('Exception: '+e);
    }
    return vec[0];
}

Creep.prototype.opposite_vector = function(x,y) {
    return [x*-1, y*-1];
}

Creep.prototype.learn_path = function() {
    if (this.memory.tracking == false) { return 'ERR_DO_NOT_TRACK'; } // Do not track this creep
    if (typeof this.memory._move == 'undefined') { return 'ERR_UNDEF_MOVE'; } // No moveTo data
    if (typeof this.memory._move.path == 'undefined') { return 'ERR_UNDEF_MOVE_PATH'; } // No moveTo path
    if (this.memory._move.path.charAt(4) == 'u') { return 'ERR_U_DIRECTION'; } // Undefined path
    if (typeof this.memory._move.dest == 'undefined') { return 'ERR_UNDEF_MOVE_DEST'; } // No moveTo destination
    if (this.memory._move.room != this.memory._move.dest.room) { return 'ERR_NOT_LOCAL'; } // Not a local path
    var p = this.memory._move.path;
    var learned = 0;
    var offset = 4;
    var direction = p.charAt(offset);
    if (direction == 'u') { return; }
    var vector = this.direction_vector(direction);
    var opposite = this.opposite_vector(vector[0], vector[1]);
    var x1 = p.substring(0,2)*1 + opposite[0];
    var y1 = p.substring(2,4)*1 + opposite[1];
    //console.log(this+' p='+p+' x1='+x1+' y1='+y1);
    // Path begins at x1,y1 and describes how to reach target.pos.x,target.pos.y
    // For a path p1,p2,p3,p4, learn the following
    // p1-p2 p1-p3 p1-p4 p2-p3 p2-p4 p3-p4
    for (var offset1=4; offset1<p.length; offset1++) {
        var x2 = x1;
        var y2 = y1;
        var src = ('00'+x1).slice(-2)+('00'+y1).slice(-2); // XXYY
        var nexthop = p.charAt(offset1);
        var vector1 = this.direction_vector(nexthop);
        var table = this.room.load_routing_table(src);
//            for (var offset2=offset1; offset2<p.length; offset2++) {
//                var direction2 = p.charAt(offset2);
//                var vector2 = this.direction_vector(direction2);
//                x2 = x2 + vector2[0];
//                y2 = y2 + vector2[1];
            //console.log(this+' path='+p+' length='+p.length+' p1='+offset1+' ('+x1+','+y1+') p2='+offset2+' ('+x2+','+y2+') direction='+nexthop);
            //this.room.set_direction({ 'x': x1, 'y': y1 }, { 'x': x2, 'y': y2 }, nexthop);
//                var dst = ('0'+x2).slice(-2)+('0'+y2).slice(-2); // XXYY
            x2 = this.memory._move.dest.x;
            y2 = this.memory._move.dest.y;
            var dst = ('00'+x2).slice(-2)+('00'+y2).slice(-2); // XXYY
            //console.log('  learning route src='+src+' dst='+dst+' nexthop='+nexthop);
            //console.log('BEFORE '+table.asString()); // WARNING! PREMATURE CALL TO .asString() = MASSIVE CPU OVERHEAD
            table.setDirectionTo(dst, nexthop);
            //console.log('CHANGE dst='+dst+' nexthop='+nexthop);
            //console.log('AFTER  '+table.asString()); // WARNING! PREMATURE CALL TO .asString() = MASSIVE CPU OVERHEAD
            learned++;
//            }
        this.room.save_routing_table(src, table);
        x1 = x1 + vector1[0];
        y1 = y1 + vector1[1];
    }
    //console.log(this.room.name+' learned: '+learned);
    return OK;
}

Creep.prototype.move_to = function(target) {
    if (this.fatigue > 0) { return; }
    //this.moveTo(target);
    this.add_stats('move')
    //return;

    //delete this.memory.nexthop;
    //delete this.memory.useexit;

    if (this.pos.roomName != target.pos.roomName) {
        // If possible, switch target to an exit leading towards target
        // This will let the creep use local routing instead of pathfinding
        if (this.memory.nexthop && this.memory.nexthop.room == this.pos.roomName) { delete this.memory.nexthop; }
        if (typeof this.memory.nexthop == 'undefined') {
            //console.log(this+' calculating route from '+this.room.name+' to '+target.pos.roomName+' (EXPENSIVE)');
            this.room.start_timer('findRoute');
            var route = Game.map.findRoute(this.room, target.pos.roomName, {
            	routeCallback(roomName) {
                    if (Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) { return 1; } // My room
            		var parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
            		if ((parsed[1] % 10 === 0) || (parsed[2] % 10 === 0)) { return 1.5; } // Highway
        			return 2.5;
            	}
            });
            this.room.stop_timer('findRoute');
            if (route == ERR_NO_PATH) {
                console.log(this+' is unable to reach '+target.pos.roomName+' (findRoute returned ERR_NO_PATH)');
                return;
            } else {
                var nexthop = route[0];
                //console.log(this+' will try to reach '+target.pos.roomName+' via '+nexthop.room);
                this.memory.nexthop = nexthop;
            }
        }
        if (this.memory.nexthop && this.memory.nexthop.exit != null) {
            if (this.memory.useexit && this.memory.useexit.roomName != this.room.name) { delete this.memory.useexit; } // Expire
            if (typeof this.memory.useexit == 'undefined') {
                //console.log(this+' finding closest exit to '+this.memory.nexthop.room+' (EXPENSIVE)');
                this.room.start_timer('findClosestByPath');
                var exit = this.pos.findClosestByPath(this.memory.nexthop.exit);
                this.room.stop_timer('findClosestByPath');
                if (exit == null) {
                    console.log(this+' in '+this.room.name+' was told to use exit direction '+this.memory.nexthop.exit+' to reach '+this.memory.nexthop.room+' but found no exits');
                } else {
                    this.memory.useexit = { x: exit.x, y: exit.y, roomName: exit.roomName };
                }
            }
            if (this.memory.useexit) {
                target = { pos: new RoomPosition(this.memory.useexit.x, this.memory.useexit.y, this.memory.useexit.roomName) };
                //console.log(this+' dummy target = '+JSON.stringify(target));
                //console.log(this+' in '+this.room.name+' using exit at '+target.pos);
            }
        }
    } else {
        delete this.memory.nexthop;
        delete this.memory.useexit;
    }

    if (this.pos.roomName == target.pos.roomName) {
        //console.log(this+' getting direction from local router');
        var direction = this.room.get_direction(this.pos, target.pos);
        if (direction >= 1 && direction <= 8) {
            //console.log('#DEBUG '+this+' ROUTER move('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+')');
            var newpos = this.next_position(direction);
            if (this.reserve_position(newpos) == true) {
                this.move(direction);
                this.say(direction);
                delete this.memory._move;
            } else {
                this.say('Traffic');
                this.room.start_timer('moveTo');
                this.moveTo(target); // Try to avoid other creeps but do not learn path
                this.room.stop_timer('moveTo');
            }
            return;
        }
    }
    if (this.pos.roomName == target.pos.roomName) {
        //console.log(this.memory.class+' '+this+' ('+this.memory.task.type+') calculating cacheable path from '+this.pos+' to '+target.pos+' (EXPENSIVE)');
        this.room.start_timer('moveTo');
        this.moveTo(target, { ignoreCreeps: true } );
        this.room.stop_timer('moveTo');
        //console.log('#DEBUG '+this+' moveTo('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+' IGNORING CREEPS) = '+this.memory._move.path);
        var result = this.learn_path();
        //if (result != OK) { console.log(this+' learn path returned '+result); }
    } else {
        //console.log(this.memory.class+' '+this+' ('+this.memory.task.type+') calculating NON-CACHEABLE path to '+target.pos+' (EXPENSIVE)');
        this.room.start_timer('moveTo');
        this.moveTo(target, { ignoreCreeps: false } );
        this.room.stop_timer('moveTo');
    }
}

Creep.prototype.next_position = function(direction) {
    var vector = this.direction_vector(direction);
    if (vector == null) { vector = [0,0]; } // Should never happen
    var newpos = new RoomPosition(this.pos.x + vector[0], this.pos.y + vector[1], this.pos.roomName);
    if (newpos.x < 0 || newpos.y < 0 || newpos.x > 49 || newpos.y > 49) { return null; } // Boundary checks
    return newpos;
}

Creep.prototype.reserve_position = function(pos) {
    // Collision detection. Return true if reservation successful (= move ok)
    // Return false if another creep has reserved or will move there using moveTo()
    var creeps_in_room = this.room.my_creeps.length;
    for (var i=0; i<creeps_in_room; i++) {
        var creep = this.room.my_creeps[i];
        // Another creep has already reserved that position
        if (creep.moving_to && creep.moving_to.x == pos.x && creep.moving_to.y == pos.y) { return false; }
        // Another creep is moving there using moveTo()
        if (creep.memory._move && creep.memory._move.dest.x == pos.x && creep.memory._move.dest.y == pos.y) { return false; }
        // Another creep is sitting there but has not indicated a movement (yet)
        if (!creep.memory.moving_to && !creep.memory._move && creep.pos.x == pos.x && creep.pos.y == pos.y) { return false; }
    }
    //console.log(this+' can not see anyone blocking '+pos);
    if (this.memory.moving_to && this.memory.moving_to.x == pos.x && this.memory.moving_to.y == pos.y) {
        // We already tried this move
        delete this.memory.moving_to;
        return false;
    }
    this.memory.moving_to = { x: pos.x, y: pos.y }; // Make reservation
    return true;
}

Creep.prototype.add_stats = function(label) {
    if (!this.memory.stats) { this.memory.stats = {}; }
    this.memory.stats[label] = (this.memory.stats[label] + 1) || 1;
}
