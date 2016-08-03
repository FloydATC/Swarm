

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
        this.memory.task = this.task;
        this.memory.target = target.toString();

        // Tasks that do not consume energy
        if (this.task == 'attack') { this.task_attack(); return; }
        if (this.task == 'ranged attack') { this.task_ranged_attack(); return; }
        if (this.task == 'recycle') { this.task_recycle(); return; }
        if (this.task == 'pick up') { this.task_pick_up(); return; }

        // Carrying something else than energy? Ignore task and store it somewhere!
        if (_.sum(this.carry) > this.carry.energy) {
            var target = shift_nearest(this.room.containers.splice());
            if (this.pos.inRangeTo(target, 1)) {
                for (var cargo in this.carry) { this.transfer(target, cargo); break; }
                this.memory.tracking = false;

            } else {
                this.move_to(target);
                this.memory.tracking = false;
            }
            return;
        }

        // Tasks that do not consume energy (continued)
        if (this.task == 'mine') { this.task_mine(); return; }
        if (this.task == 'claim') { this.task_claim(); return; }
        if (this.task == 'travel') { this.task_travel(); return; }

        // Get energy if needed
        if (this.memory.working == true && this.is_empty()) { this.memory.working = false; }
        if (this.memory.working == false && this.is_full()) { this.memory.working = true; }
        if (this.memory.working == false) { this.get_energy(); return; }

        // Energy within reach? Try to grab it.
        if (this.free > 0) {
            var treasures = this.pos.findInRange(RESOURCE_ENERGY, 1);
            if (treasures.length > 0) { this.pickup(treasures[0]); this.say('Treasure'); return; }
        }

        // Tasks that consume energy
        if (this.task == 'feed spawn') { this.task_feed(); return; }
        if (this.task == 'feed tower') { this.task_feed(); return; }
        if (this.task == 'feed extension') { this.task_feed(); return; }
        if (this.task == 'stockpile') { this.task_feed(); return; }
        if (this.task == 'build') { this.task_build(); return; }
        if (this.task == 'repair') { this.task_repair(); return; }
        if (this.task == 'upgrade') { this.task_upgrade(); return; }

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
                var want = this.carryCapacity - _.sum(this.carry);
                if (want + reserved >= energy.amount) { continue; } // Not enough left for me
                energy.reserved_amount = reserved + want;
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

        // Consider fetching energy from a container
        //console.log(this+' considers fetching energy from a container');
        if (this.task != 'upgrade' && this.task != 'stockpile') {
            var containers = this.room.containers.slice();
            while (containers.length > 0) {
                var container = this.shift_nearest(containers);
                if (container instanceof StructureContainer) {
                    var reserved = container.reserved_amount || 0;
                    if (reserved >= container.store.energy) { continue; } // Not enough left for me
                    container.reserved_amount = reserved + this.carryCapacity - _.sum(this.carry);
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

    task_mine: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 1)) {
            this.harvest(target);
            // Container with space within reach?
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

    task_build: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 3)) {
            this.build(target)
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
            this.memory.tracking = false;
        } else {
            this.move_to(target, { maxRooms: 0 }); // Stay in this room!
            this.memory.tracking = false;
        }
        return;
    },

    task_upgrade: function() {
        var target = Game.getObjectById(this.target);
        if (this.pos.inRangeTo(target, 3)) {
            this.upgradeController(target);
        } else {
            this.move_to(target);
        }
        return;
    },

    direction_vector: function(direction) {
        var vec = [[0,0], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1] ];
        return vec[direction];
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
            var nexthop = p.charAt(offset1);
            var vector1 = this.direction_vector(nexthop);
            for (var offset2=offset1; offset2<p.length; offset2++) {
                var direction2 = p.charAt(offset2);
                var vector2 = this.direction_vector(direction2);
                x2 = x2 + vector2[0];
                y2 = y2 + vector2[1];
                //console.log(this+' path='+p+' length='+p.length+' p1='+offset1+' ('+x1+','+y1+') p2='+offset2+' ('+x2+','+y2+') direction='+nexthop);
                this.room.set_direction({ 'x': x1, 'y': y1 }, { 'x': x2, 'y': y2 }, nexthop);
            }
            x1 = x1 + vector1[0];
            y1 = y1 + vector1[1];
        }
    },

    move_to: function(target) {
        if (this.fatigue > 0) { return; }
        if (this.pos.roomName == target.pos.roomName) {
            var direction = this.room.get_direction(this.pos, target.pos);
            if (direction >= 1 && direction <= 8) {
                //console.log('#DEBUG '+this+' ROUTER move('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+')');
                var newpos = this.next_position(direction);
                if (this.reserve_position(newpos)) {
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
        //console.log('#DEBUG '+this+' moveTo('+this.pos.x+','+this.pos.y+' - '+target.pos.x+','+target.pos.y+')');
        this.moveTo(target, { ignoreCreeps: true; } );
        this.learn_path();
    },

    next_position: function(direction) {
        var vector = direction_vector(direction);
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
            if (!creep.moving_to && !creep.memory._move && creep.pos.x == pos.x && creep.pos.y == pos.y) { return false; }
            this.moving_to = { x: pos.x, y: pos.y }; // Make reservation
            return true;
        }
    },

};
