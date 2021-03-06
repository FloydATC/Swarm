var Nav = require('Nav');

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
    //if (this.memory.debug) { console.log(this.adjacent); }
}

Creep.prototype.on_rampart = function() {
    let objects = this.room.lookForAt(LOOK_STRUCTURES, this);
    let rampart = _.filter(objects, { structureType: STRUCTURE_RAMPART, my: true } );
//    return false;
    return (rampart.length > 0); // True if Creep is standing on a rampart
}

Creep.prototype.is_melee = function() {
    return (this.getActiveBodyparts(ATTACK) > 0); // True if Creep has atleast one usable ATTACK part
}

Creep.prototype.is_ranged = function() {
    return (this.getActiveBodyparts(RANGED_ATTACK) > 0); // True if Creep has atleast one usable ATTACK part
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

    //if (Math.random() > 0.9) { this.speak(); }
    var debug = this.memory.debug || false;
    if (debug) { console.log(this+' execute: task='+this.memory.task.type+' target='+this.target+' is_full='+this.is_full()+' is_empty='+this.is_empty()+' ttl='+this.ticksToLive); }

    // Consider new roads
    if (this.fatigue > 0 && this.memory.tracking == true) { this.room.consider_road(this); }

    var target = Game.getObjectById(this.target);
    if (debug) { console.log(this+' target '+target); }
    if (this.memory.class == 'Drone' && target == null) {
        console.log(this.room.link()+' '+this+' is confused? target='+target+' task='+this.memory.task.type);
//        if (this.room.controller && (this.room.controller.level < 3 || this.room.spawn_reserves > 50)) {
//            target = this.room.controller;
//            this.task = 'upgrade';
//            this.target = this.room.controller.id;
//        } else {
//            this.task = 'none';
//            this.target = null;
//        }
    }
    //console.log(this+' executing task: '+this.task+' '+(target || ''));
    //this.say(this.task);
    // For debugging, place task+target in memory as human readable strings
    // For sticky targeting we must keep track of how much time has been invested
    var target_str = (target != null ? target.toString() : '(null)');
    if (typeof this.memory.task == 'object' && this.memory.task.type == this.task && this.memory.task.target == target_str) {
        this.memory.task.ticks = (this.memory.task.ticks + 1) || 1;
    } else {
        this.memory.task = { type: this.task, target: target_str, ticks: 0 };
    }

    // Tasks that do not involve a work/fetch cycle
    if (this.task == 'hunt') { this.task_hunt(); return; }
    if (this.task == 'attack') { this.task_attack(); return; }
    if (this.task == 'ranged attack') { this.task_ranged_attack(); return; }
    if (this.task == 'recycle') { this.task_recycle(); return; }
    if (this.task == 'pick up') { this.task_pick_up(); return; }
    if (this.task == 'mine') { this.task_mine(); return; }
    if (this.task == 'dismantle') { this.task_dismantle(); return; }
    if (this.task == 'extract') { this.task_extract(); return; }
    if (this.task == 'reserve') { this.task_reserve(); return; }
    if (this.task == 'remote fetch') { this.task_remote_fetch(); return; }
    if (this.task == 'claim') { this.task_claim(); return; }
    if (this.task == 'travel') { this.task_travel(); return; }
    if (this.task == 'upgrade' && this.memory.class == 'Zealot') { this.task_upgrade(); return; }

    // Carrying something else than energy? Ignore task and store it somewhere!
    if (_.sum(this.carry) > this.carry.energy) {
        var target = this.room.terminal; //this.shift_nearest(this.room.containers.splice());
        if (target == null) { target = this.room.storage; }
        if (target != null) {
            if (this.pos.inRangeTo(target, 1)) {
                for (var cargo in this.carry) {
                    var amount = this.carry[cargo];
                    if (amount > 0) {
                        //console.log(this+' xfer '+cargo+' to '+target);
                        this.transfer(target, cargo);
                        break;
                    }
                }
                this.memory.tracking = true;

            } else {
                this.move_to(target);
                this.memory.tracking = true;
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
    if (this.task == 'feed terminal') { this.task_feed(); return; }
    if (this.task == 'stockpile') { this.say('POST'); this.task_feed(); return; }
    if (this.task == 'build') { this.task_build(); return; }
    if (this.task == 'repair') { this.task_repair(); return; }
    if (this.task == 'upgrade') { this.task_upgrade(); return; } // Note: Zealots are caught earlier!

    console.log(this.room+' '+this+' has unhandled task '+this.task);
}

Creep.prototype.start_timer = function() {
    if (!(this.memory.timer_start > 0)) {
        //this.say('START');
        this.memory.timer_start = Game.time;
    }
}

Creep.prototype.stop_timer = function() {
    if (this.memory.timer_start > 0) {
        //this.say('STOP');
        this.memory.timer_last = Game.time - this.memory.timer_start;
        this.memory.timer_start = 0;
    }
}

Creep.prototype.cancel_timer = function() {
    this.memory.timer_start = 0;
}

Creep.prototype.get_energy = function() {
    var debug = this.memory.debug || false;

    // Consider energy dropped on the ground
    if (debug) { console.log(this+' looking for energy on the ground'); }
    var all_dropped_energy = this.room.dropped_energy.slice();
    while (all_dropped_energy.length > 0) {
        var energy = this.shift_nearest(all_dropped_energy);
        if (energy instanceof Resource) {
            var reserved = energy.reserved_amount || 0;
            var wanted = this.carryCapacity - _.sum(this.carry);
            var available = energy.amount;
            if (available < reserved + wanted) { continue; } // Not enough left for me
            if (debug) { console.log(this+' decided to pick up '+energy+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')'); }
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

    // Consider fetching energy from the nearest link
    if (debug) { console.log(this+' considers fetching energy from nearest link'); }
    if (this.task != 'feed link') {
        var links = this.room.links.slice();
        while (links.length > 0) {
            var link = this.shift_nearest(links);
            if (link instanceof StructureLink) {
                var reserved = link.reserved_amount || 0;
                var wanted = this.carryCapacity - _.sum(this.carry);
                var available = link.energy;
                //if (available < reserved + wanted) { break; } // Nearest has not enough left for me
                if (available - reserved <= 0) { break; } // Nearest has nothing left for me
                if (debug) { console.log(this+' decided to fetch from '+link+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')'); }
                link.reserved_amount = reserved + this.carryCapacity - _.sum(this.carry);
                if (this.pos.inRangeTo(link, 1)) {
                    this.withdraw(link, RESOURCE_ENERGY);
                    link.count_withdraw();
                    this.memory.tracking = true;
                } else {
                    this.move_to(link);
                    this.memory.tracking = true;
                }
                return;
            }
            break; // Only consider the nearest link!
        }
    }

    // Consider fetching energy from a container
    if (debug) { console.log(this+' considers fetching energy from a container to '+this.memory.task.type); }
    if (true) {
        var containers = this.room.containers.slice();
        while (containers.length > 0) {
            var container = this.shift_nearest(containers);
            if (container instanceof StructureContainer) {
                var reserved = container.reserved_amount || 0;
                var wanted = this.carryCapacity - _.sum(this.carry);
                var available = container.store.energy;
                if (available < reserved + wanted) { continue; } // Not enough left for me
                if (debug) { console.log(this+' decided to fetch from '+container+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')'); }
                container.reserved_amount = reserved + wanted;
                if (this.pos.inRangeTo(container, 1)) {
                    this.withdraw(container, RESOURCE_ENERGY);
                    this.memory.tracking = true;
                } else {
                    this.move_to(container);
                    this.memory.tracking = true;
                }
                return;
            }
        }
    }

    // Consider fetching energy from storage
    if (debug) { console.log(this+' considers fetching energy from storage'); }
    if (this.task != 'stockpile' && this.task != 'upgrade') {
        var storage = this.room.storage;
        if (storage instanceof StructureStorage) {
            var reserved = storage.reserved_amount || 0;
            var wanted = this.carryCapacity - _.sum(this.carry);
            var available = storage.store.energy;
            if (available >= reserved + wanted) {
                if (debug) { console.log(this+' decided to fetch from '+storage+' (available='+available+' , reserved='+reserved+', wanted='+wanted+')'); }
                this.say('GET');
                storage.reserved_amount = reserved + this.carryCapacity - _.sum(this.carry);
                if (this.pos.inRangeTo(storage, 1)) {
                    this.withdraw(storage, RESOURCE_ENERGY);
                    this.memory.tracking = true;
                } else {
                    this.move_to(storage);
                    this.memory.tracking = true;
                }
                return;
            }
        }
    }

    // Consider mining
    if (debug) { console.log(this+' considers mining for energy'); }
    var sources = this.room.sources.slice();
    while (sources.length > 0) {
        var source = this.shift_nearest(sources);
        if (source instanceof Source) {
            var used_slots = source.used_slots || 0;
            var free_slots = source.slots.length - used_slots + 1; // Reserve space for one dedicated miner
            if (this.pos.inRangeTo(source, 1)) {
                this.harvest(source);
                this.memory.tracking = true;
                source.used_slots = used_slots + 1; // Already AT the source = I have this slot.
            } else {
                if (free_slots < 1) { continue; } // Not enough left for me anyway
                this.move_to(source);
                this.memory.tracking = true;
                source.used_slots = used_slots + 1;
            }
            return;
        }
    }
}

Creep.prototype.shift_nearest = function(targets) {
    //var targets_by_range = targets.sort( function(a,b) { return a.pos.getRangeTo(x,y) - b.pos.getRangeTo(x,y); } );
    var lo_range = null;
    var lo_index = null;
    for (var i=0; i<targets.length; i++) {
        var range = this.room.rangeFromTo(this.pos, targets[i].pos);
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
    if (this.room.name == 'E26N36' || this.memory.destination == 'E26N36') { this.suicide(); }
    if (this.room.hostile_creeps.length > 0 || (this.memory.destination && this.memory.destination == this.room.name)) {
        console.log(this.room.link()+' '+this.memory.class+' '+this.name+' hunting hostiles');
        // Attack!
        var targets = this.room.hostile_creeps.slice();
        var target = this.shift_nearest(targets);
        while (Math.random() > 0.9) { target = this.shift_nearest(targets); } // Random chance to skip nearest
        //var target = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (target == null) {
            if (this.room.hostile_creeps.length == 0) {
                // Look for other rooms nearby that require assistance
                console.log(this.room.link()+' '+this.name+' looking for nearby rooms under attack');
                let roomnames = _.filter(_.keys(Memory.rooms), function(roomname) { return Memory.rooms[roomname].hostiles > 0; } );
                if (roomnames.length > 0) {
                    // Pick the closest one with range <= 2
                    let creep = this;
                    let nearest = _.min(roomnames, function(roomname) { let range = Game.map.getRoomLinearDistance(creep.room.name, roomname); return (range <= 2 ? range : Infinity ); } );
                    if (nearest != null) {
                        this.memory.destination == nearest;
                        console.log(this.room.link()+' '+this.name+' will assist '+this.room.link(nearest));
                        return;
                    }
                }

                // None? We are victorious!
                this.say('Victory!');
                this.memory.idle = (this.memory.idle || 0) + 1;
                if (this.memory.idle == 50) { this.suicide(); }

            }
        } else {
            this.memory.idle = 0;
            let range = this.room.rangeFromTo(this.pos, target.pos);
            if (range > 3) {
                //console.log('  out of range');
                if (this.hits < this.hitsMax) { this.heal(this); }// Attempt to heal self
                if (this.on_rampart() == false) {
                    //console.log('  advancing on target');
                    this.move_to(target, 3); // Close on target
                } else {
                    //console.log('  standing my ground');
                }
                return;
            }
            if (this.at_exit() && target != null) {
                //this.move_to(this.room.controller);
                //console.log('  on border, moving');
                this.move_to(target);
            } else {
                this.stop();
            }


            if (this.hits < this.hitsMax) { this.heal(this); }// Attempt to heal self
            if (this.is_melee() && range <= 1) { this.attack(target); return }
            this.rangedAttack(target);
            return;
        }
    }
    if (this.memory.destination && this.memory.destination != this.room.name) {
        console.log(this.room.link()+' '+this.memory.class+' '+this.name+' heading for '+this.room.link(this.memory.destination)+' to assist');
        this.move_to({ pos: new RoomPosition(25, 25, this.memory.destination) }, 20);
        return;
    }
    if (this.hits < this.hitsMax) { this.heal(this); }// Attempt to heal self
    var spawn = this.shift_nearest(this.room.spawns.slice());
    if (spawn != null) {
        if (this.room.rangeFromTo(this.pos, spawn.pos) > 1) {
            this.move_to(spawn);
        } else {
            spawn.recycleCreep(this);
        }
    }
    return;

}

Creep.prototype.task_attack = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 1)) {
        this.stop();
        this.attack(target);
        this.add_stats('attack')
    } else {
        if (this.on_rampart() == false) {
            this.move_to(target);
        }
    }
    return;
}

Creep.prototype.task_ranged_attack = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = false;
    if (this.pos.inRangeTo(target, 3)) {
        this.stop();
        this.rangedAttack(target);
        this.add_stats('ranged attack')
    } else {
        if (this.on_rampart() == false) {
            this.move_to(target, 3);
        }
    }
    return;
}

Creep.prototype.task_recycle = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = true;
    if (this.pos.inRangeTo(target, 1)) {
        this.stop();
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
    // This task should NOT be used for picking up energy!
    if (target.resourceType == RESOURCE_ENERGY) { console.log(this+' task=pick up type=RESOURCE_ENERGY is invalid'); }
    if (this.pos.inRangeTo(target, 1)) {
        this.stop();
        this.pickup(target);
        if (this.memory.debug) { console.log(this+' picking up '+target); }
    } else {
        if (this.memory.debug) { console.log(this+' moving to pick up '+target); }
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
    if (flag == null) { this.memory.class = 'Drone'; return; }
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    // In the right room yet?
    if (this.room.name == this.memory.mine) {
        var source = Game.getObjectById(flag.memory.source);
        if (source == null) {
            // Locate source at flag
            var found = this.room.lookForAt(LOOK_SOURCES, flag);
            source = found[0];
            if (source == null) { flag.remove(); return; } // User error
            flag.memory.source = source.id;
        }

        // Register as arrived if we are within 3 tiles. Old creep may be in the way.
        var arrived = this.memory.arrived || 0;
        var range = this.room.rangeFromTo(this.pos, source.pos);
        if (arrived == 0 && range <= 3) {
            this.memory.arrived = Game.time;
        }

        if (range > 1) {
            // Move closer
            this.move_to(source);
            //console.log('Miner '+this+' approaching source ('+source+' in '+this.memory.mine+')');
        } else {
            // Get energy
            this.stop();
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
            if (link != null) {
                this.transfer(link, RESOURCE_ENERGY);
                link.count_transfer();
                return;
            }

            // Container with free space within reach?
            var containers = this.containers_within_reach();
            //console.log(this+' can reach these containers: '+containers);
            var container = null;
            for (var i=0; i<containers.length; i++) {
                //console.log(this+' consider putting energy in '+containers[i]+' ('+containers[i].free+' free)');
                if (containers[i].free == 0) { continue; }
                container = containers[i]
            }
            if (container != null) {
                if (container.hits < container.hitsMax) {
                    this.repair(container); return;
                } else {
                    this.transfer(container, RESOURCE_ENERGY); return;
                }
            }

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

Creep.prototype.task_dismantle = function() {
    var flag = Game.flags[this.memory.flag];
    //console.log(this.room.link()+' '+this+' executing task: dismantle');
    if (flag == null) { this.memory.class = 'Drone'; return; }
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    // In the right room yet?
    if (this.room.name == this.memory.dismantle) {
        //console.log(this.room.link()+' '+this+' has arrived in target room');
        var structure = Game.getObjectById(flag.memory.structure);
        if (structure == null) {
            // Locate structure at flag
            var found = this.room.lookForAt(LOOK_STRUCTURES, flag);
            structure = found[0];
            if (structure == null) { flag.remove(); return; } // User error
            flag.memory.structure = structure.id;
            //console.log(this.room.link()+' '+this+' identified structure to dismantle: '+structure);
        }

        // Register as arrived if we are within 3 tiles. Old creep may be in the way.
        var arrived = this.memory.arrived || 0;
        var range = this.room.rangeFromTo(this.pos, structure.pos);
        if (arrived == 0 && range <= 3) {
            this.memory.arrived = Game.time;
        }

        if (range > 1) {
            // Move closer
            this.move_to(structure);
            //console.log('Dismantler '+this+' approaching structure ('+structure+' in '+this.memory.dismantle+')');
        } else {
            // Get energy
            this.stop();
            this.dismantle(structure);
            //console.log(this.room.link()+' Dismantler '+this+' dismantling structure ('+structure+' in '+this.memory.dismantle+')');

            // Nope. Just drop the energy on the ground then
            this.drop(RESOURCE_ENERGY);

        }
        return;
    } else {
        // No. Try to reach the room marked with a flag.
        this.move_to(flag);
        //console.log('Dismantler '+this+' moving to flag ('+flag+' in '+this.memory.dismantle+')');
        return;
    }
}

Creep.prototype.task_extract = function() {
    var flag = Game.flags[this.memory.flag];
    if (flag == null) { this.memory.class = 'Drone'; return; }
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    // In the right room yet?
    if (this.room.name == this.memory.extract) {
        var mineral = Game.getObjectById(flag.memory.mineral);
        if (mineral == null) {
            // Locate extractor at flag
            var found = this.room.lookForAt(LOOK_MINERALS, flag);
            mineral = found[0];
            if (mineral == null) { flag.remove(); return; } // User error
            flag.memory.mineral = mineral.id;
        }

        // Register as arrived if we are within 3 tiles. Old creep may be in the way.
        var arrived = this.memory.arrived || 0;
        var range = this.room.rangeFromTo(this.pos, mineral.pos);
        if (arrived == 0 && range <= 3) {
            this.memory.arrived = Game.time;
        }

        if (range > 1) {
            // Move closer
            this.move_to(mineral);
            //console.log('Miner '+this+' approaching source ('+source+' in '+this.memory.mine+')');
        } else {
            // Get resources
            this.stop();
            this.harvest(mineral);
            //console.log('Extractor '+this+' harvesting from ('+mineral+' in '+this.memory.mineral+')');

            // Just drop the resources on the ground
            //this.drop(Object.keys(this.carry)[0])
            var creep = this;
            //console.log('  Carrying '+JSON.stringify(this.carry));
            for (var cargo in this.carry) { this.drop(cargo); break; }
        }
        return;
    } else {
        // No. Try to reach the room marked with a flag.
        this.move_to(flag);
        //console.log('Miner '+this+' moving to flag ('+flag+' in '+this.memory.mine+')');
        return;
    }
}

Creep.prototype.task_reserve = function() {
    var flag = Game.flags[this.memory.flag];
    if (flag == null) { this.suicide(); return; } // No work or carry parts.
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    // In the right room yet?
    if (this.room.name == this.memory.reserve) {
        var ctrl = this.room.controller;
        if (ctrl == null) {
            flag.remove(); return;  // User error
        }

        // Register as arrived if we are within 3 tiles. Old creep may be in the way.
        var arrived = this.memory.arrived || 0;
        var range = this.room.rangeFromTo(this.pos, ctrl.pos);
        if (arrived == 0 && range <= 3) {
            this.memory.arrived = Game.time;
        }

        if (range > 1) {
            // Move closer
            this.move_to(ctrl);
            //console.log('Reserver '+this+' approaching controller ('+ctrl+' in '+this.memory.reserve+')');
        } else {
            // Reserve controller
            this.stop();
            this.reserveController(ctrl);
            //console.log('Reserver '+this+' reserving controller ('+ctrl+' in '+this.memory.reserve+')');
        }
        return;
    } else {
        // No. Try to reach the room marked with a flag.
        this.move_to(flag);
        //console.log('Reserver '+this+' moving to flag ('+flag+' in '+this.memory.reserve+')');
        return;
    }
}

Creep.prototype.task_remote_fetch = function() {
    var flag = Game.flags[this.memory.flag];
    if (flag == null) { this.memory.class = 'Drone'; return; }
    flag.assign_worker(this); // Check in with flag
    this.memory.tracking = true;
    if (this.memory.working == true && this.is_empty()) { this.memory.working = false; }
    if (this.memory.working == false && this.is_full()) { this.memory.working = true; }
    if (this.memory.timer_last) {
        var trip = this.memory.timer_last * 2;
        flag.memory.rtt = Math.floor(((flag.memory.rtt || trip) + trip) / 2);
        delete this.memory.timer_last;
    }
    if (this.memory.working == false) {
        // In the right room yet?
        if (this.room.name == this.memory.mine) {
            // Yes, in the right room

            // Is there energy on the ground melting away?
            var loot = this.pos.findClosestByRange(FIND_DROPPED_ENERGY);
            if (loot != null && loot.amount >= 50) {
                //console.log('fetcher '+this+' spotted energy on the ground: '+loot);
                var range = this.room.rangeFromTo(this.pos, loot.pos);
                if (range > 1) {
                    this.move_to(loot);
                } else {
                    this.stop();
                    this.pickup(loot);
                    this.stop_timer();
                }
                return;
            }

            // Locate source at flag
            var found = this.room.lookForAt(LOOK_SOURCES, flag);
            var source = found[0];
            if (source != null) {
                if (this.room.rangeFromTo(this.pos, source.pos) > 1) {
                    // Move closer
                    this.move_to(source);
                    //console.log('Fetcher '+this+' approaching source ('+source+' in '+this.memory.mine+')');
                } else {
                    // Get energy -- dedicated miner missing or behind schedule?
                    this.stop();
                    this.harvest(source);
                    this.stop_timer();
                    //console.log('Fetcher '+this+' harvesting source ('+source+' in '+this.memory.mine+')');
                }
            } else {
                found = this.room.lookForAt(LOOK_STRUCTURES, flag);
                var structure = found[0];
                if (structure != null) {
                    if (this.room.rangeFromTo(this.pos, structure.pos) > 1) {
                        // Move closer
                        this.move_to(structure);
                        //console.log('Fetcher '+this+' approaching source ('+source+' in '+this.memory.mine+')');
                    } else {
                        // Get energy -- dedicated miner missing or behind schedule?
                        this.stop();
                        this.dismantle(structure);
                        this.stop_timer();
                        //console.log('Fetcher '+this+' dismantling structure ('+structure+' in '+this.memory.dismantle+')');
                    }
                }
            }

            // Dropped energy within reach? Grab it.
            //var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
            var treasures = this.energy_within_reach();
            if (treasures.length > 0) {
                this.pickup(treasures[0]);
                this.stop_timer();
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
            var range = this.room.rangeFromTo(this.pos, target.pos);
            if (upgrader && range <= 1) {
                this.drop(RESOURCE_ENERGY);
                this.start_timer();
                //console.log('Fetcher '+this+' assisting ('+upgrader+' in '+this.memory.home+')');
                return;
            }
            if (range > 1) {
                // Adjacent link? Try to unload (use link as "drop box")
                var links = this.links_within_reach();
                if (links.length > 0) {
                    this.transfer(links[0], RESOURCE_ENERGY);
                    links[0].count_transfer();
                }
                this.move_to(target);
                //console.log('Fetcher '+this+' approaching target ('+target+' in '+this.memory.home+')');
                //return;
            };
            if (ctrl && range <= 3) {
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
                    this.cancel_timer(); // If we run out of energy it must not count as a completed roundtrip
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
        this.stop();
        this.claimController(target);
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_travel = function() {
    var result = this.move_to({ pos: new RoomPosition(25, 25, this.memory.destination)}, 10);
    this.memory.tracking = true;
    //console.log(this+' moveTo '+this.memory.destination+' result='+result);
    return;
}

Creep.prototype.task_feed = function() {
    var target = Game.getObjectById(this.target);
    this.memory.tracking = true;
    //this.say('f:'+target.pos.x+','+target.pos.y);
    if (this.pos.inRangeTo(target, 1)) {
        this.stop();
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
        this.stop();
        this.transfer(target, RESOURCE_ENERGY);
        target.count_transfer();
    } else {
        this.move_to(target);
    }
    return;
}

Creep.prototype.task_build = function() {
    var target = Game.getObjectById(this.target); // Room has already assigned nearest?
    if (target == null) { target = this.shift_nearest(this.room.csites.slice()); }
    console.log(this+' build target='+target);
    this.memory.tracking = true;
    if (this.pos.inRangeTo(target, 3)) {
        this.stop();
        this.build(target);
        this.add_stats('build')
    } else {
        this.move_to(target, 3);
    }
    return;
}

Creep.prototype.task_repair = function() {
    var target = Game.getObjectById(this.target); // Room has already assigned nearest
    if (target == null) { target = this.shift_nearest(this.room.need_repairs.slice()); }
    this.memory.tracking = true;
    //this.say(target.pos.x+','+target.pos.y);
    if (this.pos.inRangeTo(target, 3)) {
        this.stop();
        this.repair(target)
        this.add_stats('repair')
    } else {
        this.move_to(target, 3); // Stay in this room!
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
    var range = this.room.rangeFromTo(this.pos, target.pos);
    this.memory.tracking = true;
    //console.log(this.memory.class+' '+this+' upgrade target ['+(target.structureType)+'] range ['+range+']');
    if (target.structureType == STRUCTURE_CONTROLLER && range <= 3) {
        //console.log('  ok, upgrade it');
        this.stop();
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
            if (treasures.length > 0) { this.pickup(treasures[0]); return; }
            var links = this.links_within_reach();
            if (links.length > 0) {
                this.withdraw(links[0], RESOURCE_ENERGY, this.free);
                links[0].count_withdraw();
                return;
            }
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
            this.move_to(ctrl, 3);
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
        console.log('Exception in direction_vector: '+e+', stack: '+e.stack);
        Game.notify('Exception in direction_vector: '+e+', stack:'+e.stack);
    }
    return vec[0];
}

Creep.prototype.opposite_vector = function(x,y) {
    return [x*-1, y*-1];
}

Creep.prototype.learn_serialized_path = function(to, p) {
    if (this.memory.tracking == false) { return 'ERR_DO_NOT_TRACK'; } // Do not track this creep
    if (typeof p == 'undefined') { return 'ERR_UNDEF_MOVE_PATH'; } // No moveTo path
    if (p == '') { return 'ERR_EMPTY_MOVE_PATH'; } // No moveTo path
    if (p.charAt(4) == 'u') { return 'ERR_U_DIRECTION'; } // Undefined path
    if (to.roomName != this.pos.roomName) { return 'ERR_NOT_LOCAL'; }
    //var p = this.memory._move.path;
    //console.log(this+' at '+this.pos+' learn_serialized_path() '+p);
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
            x2 = to.x;
            y2 = to.y;
            var dst = ('00'+x2).slice(-2)+('00'+y2).slice(-2); // XXYY
            //console.log('  learning route src='+src+' dst='+dst+' nexthop='+nexthop);
            //console.log('BEFORE '+table.asString()); // WARNING! PREMATURE CALL TO .asString() = MASSIVE CPU OVERHEAD
            table.setDirectionTo(x2 + (50 * y2), nexthop);
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

Creep.prototype.move_to = function(target, within) {
    if (this.fatigue > 0) { return; }
    this.add_stats('move');



    // Check for tile hint
    var direction = Nav.get_direction(this.pos, target.pos);
    if (direction >= 1 && direction <= 8 && Math.random() > 0.02) {
        //console.log('#DEBUG '+this+' ROUTER move('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+')');
        var newpos = this.next_position(direction);
        if (this.reserve_position(newpos) == true) {
            this.move(direction);
            //this.say(direction);
            delete this.memory._move;
        } else {
            this.say('Traffic');
            this.room.start_timer('moveTo');
            this.moveTo(target); // Try to avoid other creeps but do not learn path
            this.room.stop_timer('moveTo');
        }
        return;
    }

    //console.log(this.memory.class+' '+this+' ('+this.memory.task.type+') calculating cacheable path from '+this.pos+' to '+target.pos+' (EXPENSIVE)');
    this.room.start_timer('findPath');
    //this.moveTo(target, { ignoreCreeps: true } );
    var p = this.room.findPath(this.pos, target.pos, { ignoreCreeps: true, serialize: true });

    // Use new pathfinder
    this.say('slow');
    var goal = { pos: target.pos, range: (within || 1) };
    var ret = PathFinder.search(
        this.pos, goal,
        {
            // We need to set the defaults costs higher so that we
            // can set the road cost lower in `roomCallback`
            plainCost: 2,
            swampCost: 10,
            maxOps: 3000,

            roomCallback: function(roomName) {

                // Is this room on the 'avoid' list?
                if (Memory.avoid && _.filter(Memory.avoid, function(name) { return name == roomName; } ).length > 0) {
                    console.log('Room '+roomName+' is on the avoid list');
                    return false;
                }

                let room = Game.rooms[roomName];
                if (!room) { return; } // No vision so pathfinding will be inaccurate
                if (room.costmatrix) {
                    //console.log('  reusing costmatrix for '+roomName);
                    return room.costmatrix;
                }
                let costs = new PathFinder.CostMatrix;

                // Prefer roads, avoid non-walkable structures
                room.find(FIND_STRUCTURES).forEach(function(s) {
                    if (s.structureType === STRUCTURE_ROAD) {
                        // Favor roads over plain tiles
                        costs.set(s.pos.x, s.pos.y, 1);
                    } else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
                        // Can't walk through non-walkable buildings
                        costs.set(s.pos.x, s.pos.y, 0xff);
                    }
                });

                // Examine construction sites
                room.find(FIND_CONSTRUCTION_SITES).forEach(function(csite) {
                    if (csite.structureType === STRUCTURE_ROAD) {
                        // Favor unfinished roads over plain tiles
                        costs.set(csite.pos.x, csite.pos.y, 1.5);
                    }
                });

                room.costmatrix = costs;

                return costs;
            },
        }
    );
    //if (ret.incomplete == true) { console.log(this.room.link()+' '+this+' got an incomplete path for '+target.pos); }
    //console.log(this+' PathFinder returned '+ret.path);
    Nav.learn_path(this.pos, target.pos, ret.path);
    this.moveTo(ret.path[0]);
    //this.moveByPath(p);
    //console.log(this+' p='+p+' _move.path='+this.memory._move.path);
    this.room.stop_timer('findPath');
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

Creep.prototype.stop = function() {
    // Signal to other creeps that this creep will not be moving
    delete this.memory._move;
    delete this.memory.moving_to;
}

Creep.prototype.at_exit = function() {
    if (this.pos.x == 0 || this.pos.x == 49) { return true; }
    if (this.pos.y == 0 || this.pos.y == 49) { return true; }
    return false;
}
