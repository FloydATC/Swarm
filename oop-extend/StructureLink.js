
module.exports = {}; // Nothing

StructureLink.prototype.initialize = function() {
    //console.log(this+' initializing');
    this.free = this.energyCapacity - this.energy;
    this.room.link_count++;
    this.room.link_total += this.energy;
    this.room.link_average = Math.floor(this.room.link_total / this.room.link_count);
    this.reserved_amount = 0;
    this.energy_pct = this.energy * 100 / this.energyCapacity;

    if (typeof this.room.memory.links == 'undefined') { this.room.memory.links = {}; }
    this.loc = this.pos.x+','+this.pos.y;
    this.room.memory.links[this.loc] = ((this.room.memory.links[this.loc] || 0) * 0.99);
}

StructureLink.prototype.execute = function() {
    //console.log(this+' execute() with energy='+this.energy+' average='+this.room.link_average);
    if (this.cooldown > 0) { return; } // Unable to transfer
//    if (this.energy <= this.room.link_average) { return; } // We should receive, not transmit
//    var peer = this.shift_least_energy(this.room.links.slice());
    //console.log('  peer '+peer+' has '+peer.energy+' energy');
//    var amount = this.room.link_average - peer.energy;
//    if (amount >= 50) {
//        //console.log(this.room+' '+this+' transferring '+amount+' to '+peer);
//        this.transferEnergy(peer, amount);
//    }
    if (this.direction() < -3) { return; }  // Creeps withdraw from this link
    if (this.energy_pct >= 25) {
        // More than 25% full, transfer to the receiver with least energy
        let lo_index = null;
        let lo_energy = null;
        for (let i in this.room.links) {
            let peer = this.room.links[i];
            if (peer.id == this.id) { continue; } // Self
            if (peer.direction() > this.direction()) { continue; } // Peer receives more energy than this link
            if (peer.free > 1) {
                if (lo_energy == null || peer.energy < lo_energy) {
                    lo_energy = peer.energy;
                    lo_index = i;
                }
            }
        }
        if (lo_index != null) {
            let peer = this.room.links[lo_index];
            //console.log(this.room.link()+' '+this+' transferring energy to '+peer);
            this.transferEnergy(peer, Math.min(this.energy-1, peer.free-1));
        }
    }

}

StructureLink.prototype.shift_least_energy = function(objects) {
    var sorted = objects.sort( function(a,b) { return a.energy - b.energy; } );
    //console.log(sorted);
    return sorted.shift();
}

StructureLink.prototype.count_transfer = function() {
    let loc = this.pos.x+','+this.pos.y;
    this.room.memory.links[loc] = ((this.room.memory.links[loc] || 0) * 0.9) + 1;
    //console.log(this.room.link()+' '+this+' at '+this.pos+' transfer => direction='+this.room.memory.links[loc]);
}

StructureLink.prototype.count_withdraw = function() {
    let loc = this.pos.x+','+this.pos.y;
    this.room.memory.links[loc] = ((this.room.memory.links[loc] || 0) * 0.9) - 1;
    //console.log(this.room.link()+' '+this+' at '+this.pos+' withdraw => direction='+this.room.memory.links[loc]);
}

StructureLink.prototype.direction = function() {
    let loc = this.pos.x+','+this.pos.y;
    let direction = this.room.memory.links[loc] || 0;
    //console.log(this.room.link()+' '+this+' at '+this.pos+' direction='+direction);
    return direction;
}
