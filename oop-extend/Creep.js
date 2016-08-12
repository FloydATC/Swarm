

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        if (!this.memory.working) { this.memory.working = false; }
        this.memory.age = (this.memory.age + 1) || 1;
        this.memory.where = this.room.name;
        this.free = this.carryCapacity - _.sum(this.carry);

    },

    speak: function() {
        var comments = [ '*bzz*', '*chirp*', '*chirr*', '*chirrup*', '*chitter*', '*click*', '*clitter*', '*cricket*' ];
        this.say(comments[Math.floor(Math.random() * comments.length)], true);
    },

    execute: function() {

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
            this.memory.task = { type: this.task, target: target.toString(), ticks: 0 };
        }

        // Tasks that do not involve a work/fetch cycle
        if (this.task == 'attack') { this.task_attack(); return; }
        if (this.task == 'ranged attack') { this.task_ranged_attack(); return; }
        if (this.task == 'recycle') { this.task_recycle(); return; }
        if (this.task == 'pick up') { this.task_pick_up(); return; }
        if (this.task == 'remote mine') { this.task_remote_mine(); return; }
        if (this.task == 'remote fetch') { this.task_remote_fetch(); return; }
        if (this.task == 'mine') { this.task_mine(); return; }
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
            var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
            if (treasures.length > 0) { this.pickup(treasures[0]); this.say('Treasure'); return; }
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
    },

    get_energy: function() {

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


    },

    shift_nearest: function(targets) {
        var x = this.pos.x;
        var y = this.pos.y;
        var targets_by_range = targets.sort( function(a,b) { return a.pos.getRangeTo(x,y) - b.pos.getRangeTo(x,y); } );
        return targets_by_range.shift();
    },

    is_full: function() {
        return (_.sum(this.carry) >= this.carryCapacity);
    },

    is_empty: function() {
        return (_.sum(this.carry) == 0);
    },

    is_harmless: function() {
        if (this.getActiveBodyparts(ATTACK) > 0) { return false; } // Can bite
        if (this.getActiveBodyparts(RANGED_ATTACK) > 0) { return false; } // Can shoot
        if (this.getActiveBodyparts(CLAIM) > 0) { return false; } // Can claim/reserve/attack controller
        if (this.getActiveBodyparts(WORK) > 0) { return false; } // Can dismantle
        return true;
    },

    task_attack: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.attack(target);
            this.add_stats('attack')
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_ranged_attack: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 3)) {
            this.rangedAttack(target);
            this.add_stats('ranged attack')
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_recycle: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            if (this.carry.energy > 0) {
                this.transfer(target, RESOURCE_ENERGY);
            } else {
                target.recycleCreep(this);
            }
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_pick_up: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.pickup(target);
            this.memory.tracking = false;
        } else {
            if (this.carry.energy) { this.drop(RESOURCE_ENERGY); } // Make room for valuables!
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_remote_mine: function() {
        var flag = Game.flags[this.memory.flag];
        flag.assign_worker(this); // Check in with flag
        this.memory.tracking = true;
        // In the right room yet?
        if (this.room.name == this.memory.mine) {
            // Yes. Locate source at flag
            var found = this.room.lookForAt(LOOK_SOURCES, flag);
            var source = found[0];
            if (source == null) { flag.remove(); return; } // User error
            if (this.pos.getRangeTo(source) > 1) {
                // Move closer
                this.move_to(source);
                //console.log('Miner '+this+' approaching source ('+source+' in '+this.memory.mine+')');
            } else {
                // Get energy
                this.harvest(source);
                //console.log('Miner '+this+' harvesting source ('+source+' in '+this.memory.mine+')');
            }
            return;
        } else {
            // No. Try to reach the room marked with a flag.
            this.move_to(flag);
            //console.log('Miner '+this+' moving to flag ('+flag+' in '+this.memory.mine+')');
            return;
        }
    },

    task_remote_fetch: function() {
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
                var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
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
                    console.log('Fetcher '+this+' assisting ('+upgrader+' in '+this.memory.home+')');
                    return;
                }
                if (this.pos.getRangeTo(target) > 1) {
                    this.move_to(target);
                    //console.log('Fetcher '+this+' approaching target ('+target+' in '+this.memory.home+')');
                    //return;
                };
                if (ctrl && this.pos.getRangeTo(target) <= 3) {
                    this.upgradeController(ctrl);
                    console.log('Fetcher '+this+' upgrading controller ('+ctrl+' in '+this.memory.home+')');
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
    },

    task_mine: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.harvest(target);
            // Link with free space within reach?
            var links = this.pos.findInRange(STRUCTURE_LINK, 1);
            var link = null;
            for (var i=0; i<links.length; i++) {
                if (links[i].free == 0) { continue; }
                link = links[i]
            }
            if (link != null) {
                this.transfer(link, RESOURCE_ENERGY);
            } else {
                // Container with free space within reach?
                var containers = this.pos.findInRange(STRUCTURE_CONTAINER, 1);
                var container = null;
                for (var i=0; i<containers.length; i++) {
                    if (containers[i].free == 0) { continue; }
                    container = containers[i]
                }
                if (container != null) {
                    this.transfer(container, RESOURCE_ENERGY);
                } else {
                    // Nope. Just drop the energy on the ground then
                    this.drop(RESOURCE_ENERGY);
                }
            }
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = true;
        }
        return;
    },

    task_claim: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.claimController(target);
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_travel: function() {
        var result = this.move_to(new RoomPosition(25, 25, this.memory.destination));
        this.memory.tracking = true;
        //console.log(this+' moveTo '+this.memory.destination+' result='+result);
        return;
    },

    task_feed: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.transfer(target, RESOURCE_ENERGY);
        } else {
            this.move_to(target);
        }
        return;
    },

    task_feed_link: function() {
        var target = this.shift_nearest(this.room.links.slice()); // Always switch to nearest
        this.target = target.id;
        if (this.pos.inRangeTo(target, 1)) {
            this.transfer(target, RESOURCE_ENERGY);
        } else {
            this.move_to(target);
        }
        return;
    },

    task_build: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 3)) {
            this.build(target);
            this.add_stats('build')
            this.memory.tracking = false;
        } else {
            this.move_to(target);
            this.memory.tracking = false;
        }
        return;
    },

    task_repair: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 3)) {
            this.repair(target)
            this.add_stats('repair')
            this.memory.tracking = false;
        } else {
            this.move_to(target, { maxRooms: 0 }); // Stay in this room!
            this.memory.tracking = false;
        }
        return;
    },

    task_upgrade: function() {
        var target = Game.getObjectById(this.target);
        var flag = Game.flags[this.memory.flag];
        if (flag != null) { flag.assign_worker(this); } // Check in with flag
        if (this.pos.inRangeTo(target, 3)) {
            delete this.memory._move;
            delete creep.memory.moving_to;
            if (this.carry.energy > 0) {
                //console.log(this+' has energy and should upgrade '+target);
                this.upgradeController(target);
                this.add_stats('upgrade');
                if (this.memory.class == 'Zealot') {
                    this.say('Praise GCL!');
                    this.room.memory.upgrader = this.id;
                }
            }
            if (this.free > 0) {
                //console.log(this+' has free space');
                var treasures = this.pos.findInRange(FIND_DROPPED_ENERGY, 1);
                if (treasures.length > 0) { this.pickup(treasures[0]); }
            }
        } else {
            this.move_to(target);
        }
        return;
    },

    direction_vector: function(direction) {
        var vec = [[0,0], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1] ];
        if (direction >= 1 && direction <= 8) { return vec[direction]; }
        console.log('INVALID direction_vector('+direction+')');
        return vec[0];
    },

    opposite_vector: function(x,y) {
        return [x*-1, y*-1];
    },

    learn_path: function() {
        if (this.memory.tracking != true) { return; } // Do not track this creep
        if (typeof this.memory._move == 'undefined') { return; } // No moveTo data
        if (typeof this.memory._move.path == 'undefined') { return; } // No moveTo path
        if (this.memory._move.path.charAt(4) == 'u') { return; } // Undefined path
        if (typeof this.memory._move.dest == 'undefined') { return; } // No moveTo destination
        if (this.memory._move.room != this.memory._move.dest.room) { return; } // Not a local path
        var p = this.memory._move.path;
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
            var src = ('0'+x1).slice(-2)+('0'+y1).slice(-2); // XXYY
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
                var dst = ('0'+x2).slice(-2)+('0'+y2).slice(-2); // XXYY
                table.setDirectionTo(dst, nexthop);
//            }
            this.room.save_routing_table(src, table);
            x1 = x1 + vector1[0];
            y1 = y1 + vector1[1];
        }
    },

    move_to: function(target) {
        if (this.fatigue > 0) { return; }
        //this.moveTo(target);
        this.add_stats('move')
        //return;

        if (this.pos.roomName == target.pos.roomName) {
            var direction = this.room.get_direction(this.pos, target.pos);
            if (direction >= 1 && direction <= 8) {
                console.log('#DEBUG '+this+' ROUTER move('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+')');
                var newpos = this.next_position(direction);
                if (this.reserve_position(newpos) == true) {
                    this.move(direction);
                    this.say(direction);
                    delete this.memory._move;
                } else {
                    this.say('Traffic');
                    this.moveTo(target); // Try to avoid other creeps but do not learn path
                }
                return;
            }
        }
        this.moveTo(target, { ignoreCreeps: true } );
        console.log('#DEBUG '+this+' moveTo('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+') = '+this.memory._move.path);
        this.learn_path();

    },

    next_position: function(direction) {
        var vector = this.direction_vector(direction);
        if (vector == null) { vector = [0,0]; } // Should never happen
        var newpos = new RoomPosition(this.pos.x + vector[0], this.pos.y + vector[1], this.pos.roomName);
        if (newpos.x < 0 || newpos.y < 0 || newpos.x > 49 || newpos.y > 49) { return null; } // Boundary checks
        return newpos;
    },

    reserve_position: function(pos) {
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
        if (this.memory.moving_to && this.memory.moving_to.x == pos.x && this.memory.moving_to.y == pos.y) {
            // We already tried this move
            delete this.memory.moving_to;
            return false;
        }
        this.memory.moving_to = { x: pos.x, y: pos.y }; // Make reservation
        return true;
    },

    add_stats: function(label) {
        if (!this.memory.stats) { this.memory.stats = {}; }
        this.memory.stats[label] = (this.memory.stats[label] + 1) || 1;
    },

};
