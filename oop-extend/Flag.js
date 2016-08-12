

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.workers = [];
        for (var i in this.memory.workers) {
            var id = this.memory.workers[i];
            var creep = Game.getObjectById(id);
            if (creep != null) { this.workers.push(creep); }
        }
        this.memory.workers = this.workers;
        this.memory.lead_time = this.memory.lead_time || 100;
        this.memory.last_spawn = this.memory.last_spawn || {};
        this.memory.workforce = this.memory.workforce || {};
    },

    type: function() {
        // Return name without trailing numbers
        // E.g. name='harvest2' -> type='harvest'
        var regex = /^([a-zA-Z]+)/;
        var result = regex.exec(this.name);
        return result[0];
        //var matches = this.name.match(/^([a-z]+)/);
        //return matches[0];
    },

    workers: function() {
        return this.workers;
    },

    assign_worker: function(creep) {
        this.memory.workers.push(creep.id);
    },

    worker_count: function(class) {
        var count = 0;
        for (var i in this.workers) {
            var creep = Game.getObjectById(this.workers[i]);
            if (creep.memory.class == class) { count++; }
        }
        return count;
    },

    worker_lowest_ttl: function(class) {
        var lowest_ttl = CREEP_LIFE_TIME;
        for (var i in this.workers) {
            var creep = Game.getObjectById(this.workers[i]);
            if (creep.ticksToLive < lowest_ttl) { lowest_ttl = creep.ticksToLive; }
        }
        return lowest_ttl;
    },

    needs: function() {
        for (var class in this.memory.workforce) {
            var minimum = this.memory.workforce[class];
            var count = this.worker_count(class);
            if (count < minimum || (count == minimum && this.worker_lowest_ttl(class) < this.memory.lead_time)) {
                return class;
            }
        }
    },

    spawned: function(class) {
        this.memory.last_spawn[class] = Game.time;
    },
};
