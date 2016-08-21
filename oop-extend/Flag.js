
module.exports = {}; // Nothing


Flag.prototype.initialize = function() {
    //console.log(this+' initializing');
    if (typeof this.memory.workers == 'undefined') this.memory.workers = [];
    this.workers = [];
    for (var i=0; i<this.memory.workers.length; i++) {
        var id = this.memory.workers[i];
        var creep = Game.getObjectById(id);
        if (creep != null) { this.workers.push(creep.id); }
    }
    this.memory.workers = this.workers;
    this.memory.lead_time = this.memory.lead_time || 100;
    this.memory.cooldown = this.memory.lead_time || 300;
    this.memory.last_spawn = this.memory.last_spawn || {};
    this.memory.workforce = this.memory.workforce || {};
    //console.log(this+' initialized. workers='+this.workers);
}

Flag.prototype.type = function() {
    // Return name without trailing numbers
    // E.g. name='harvest2' -> type='harvest'
    var regex = /^([a-zA-Z]+)/;
    var result = regex.exec(this.name);
    return result[0];
    //var matches = this.name.match(/^([a-z]+)/);
    //return matches[0];
}

Flag.prototype.workers = function() {
    return this.workers;
}

Flag.prototype.has_worker = function(creep) {
    for (var i in this.workers) {
        if (this.workers[i] == creep.id) { return true; }
    }
    return false;
}

Flag.prototype.assign_worker = function(creep) {
    //console.log(this+' creep checking in: '+creep);
    if (this.has_worker(creep)) { return; }
    this.memory.workers.push(creep.id);
}

Flag.prototype.worker_count = function(c) {
    var count = 0;
    for (var i in this.workers) {
        var creep = Game.getObjectById(this.workers[i]);
        if (creep.memory.class == c) { count++; }
        // Auto-adjust lead time
        if (creep.memory.spawned && creep.memory.arrived) {
            this.memory.lead_time = Math.floor((this.memory.lead_time + (creep.memory.arrived - creep.memory.spawned)) / 2);
            delete creep.memory.spawned;
        }
    }
    return count;
}

Flag.prototype.worker_lowest_ttl = function(c) {
    var lowest_ttl = CREEP_LIFE_TIME;
    for (var i in this.workers) {
        var creep = Game.getObjectById(this.workers[i]);
        if (creep.memory.class != c) { continue; } // Not the class we are looking for
        if (creep.ticksToLive < lowest_ttl) { lowest_ttl = creep.ticksToLive; }
    }
    return lowest_ttl;
}

Flag.prototype.needs = function() {
    for (var c in this.memory.workforce) {
        var cooled = (this.memory.last_spawn[c] || 0) + this.memory.cooldown;
        //console.log(this+' spawn '+c+'? last='+this.memory.last_spawn[c]+' cooldown='+this.memory.cooldown+' time='+Game.time+' cooled='+cooled);
        if (Game.time < cooled) { continue; }
        var minimum = this.memory.workforce[c];
        var count = this.worker_count(c);
        //console.log(this+' spawn '+c+' have='+count+' want='+minimum);
        if (count < minimum || (count == minimum && this.worker_lowest_ttl(c) < this.memory.lead_time)) {
            //console.log(this.pos.roomName+' '+this+' needs a '+c);
            return c;
        }
    }
    return null;
}

Flag.prototype.spawned = function(c) {
    this.memory.last_spawn[c] = Game.time;
}
