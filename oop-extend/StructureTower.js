

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.energy_pct = this.energy * 100 / this.energyCapacity;
    },

    execute: function() {
        // Priority 1: Shoot threats
        if (this.energy_pct > 0) {
            // Fire at nearest actual threat
            //console.log(this+' looking for threats');
            var redfor = this.room.hostile_creeps.slice();
            while (redfor.length > 0) {
                var hostile = this.shift_nearest(redfor);
                if (hostile.is_harmless()) { continue; }
                //console.log(this+' attacking threat '+hostile);
                this.attack(hostile);
                return;
            }
        }

        // Priority 2: Shoot other hostiles
        if (this.energy_pct > 95) {
            // Fire at nearest harmless threat
            //console.log(this+' looking for other hostiles');
            var redfor = this.room.hostile_creeps.slice();
            while (redfor.length > 0) {
                var hostile = this.shift_nearest(redfor);
                //console.log(this+' attacking hostile '+hostile);
                this.attack(hostile);
                return;
            }
        }

        // Priority 3: Heal friendlies
        if (this.energy_pct > 75) {
            // Heal nearest injured friendly
            //console.log(this+' looking for injured friendlies');
            var blufor = this.room.my_creeps.slice();
            while (blufor.length > 0) {
                var friendly = this.shift_weakest(blufor);
                if (friendly.hits >= friendly.hitsMax) { continue; }
                //console.log(this+' healing friendly '+friendly);
                this.heal(friendly);
                return;
            }
        }

        // Priority 4: Repair damages
        if (this.energy_pct > 75) {
            // Repair nearest damaged structure
            var damaged = this.room.need_repairs.slice();
            while (damaged.length > 0) {
                var structure = damaged.shift();
                if (structure.structureType == STRUCTURE_WALL && structure.hits > 10000 && this.pos.getRangeTo(structure) >= TOWER_FALLOFF_RANGE) { continue; }
                if (structure.structureType == STRUCTURE_WALL && structure.hits > 100000) { continue; }
                //console.log(this+' repairing '+structure);
                this.repair(structure);
                return;
            }
        }

        //console.log(this+' waiting');
    },

    shift_nearest: function(targets) {
        var x = this.pos.x;
        var y = this.pos.y;
        var targets_by_range = targets.sort( function(a,b) { return a.pos.getRangeTo(x,y) - b.pos.getRangeTo(x,y); } );
        return targets_by_range.shift();
    },

    shift_weakest: function(targets) {
        var x = this.pos.x;
        var y = this.pos.y;
        var targets_by_health = targets.sort( function(a,b) { return a.hits - b.hits; } );
        return targets_by_health.shift();
    },


};
