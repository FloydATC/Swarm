

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
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
        if (typeof this.memory.workers == 'undefined') { this.memory.workers = []; }
        var creeps = [];
        for (var i in this.memory.workers) {
            var id = this.memory.workers[i];
            var creep = Game.getObjectById(id);
            if (creep != null) { creeps.push(creep); }
        }
        return creeps;
    },

    assign_worker: function(creep) {
        if (typeof this.memory.workers == 'undefined') { this.memory.workers = []; }
        this.memory.workers.push(creep.id);
        creep.memory.flag = this.id;
    },
};
