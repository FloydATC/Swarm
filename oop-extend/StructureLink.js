
module.exports = {}; // Nothing

StructureLink.prototype.initialize = function() {
    //console.log(this+' initializing');
    this.free = this.energyCapacity - this.energy;
    this.room.link_count++;
    this.room.link_total += this.energy;
    this.room.link_average = Math.floor(this.room.link_total / this.room.link_count);
    this.reserved_amount = 0;

    if (typeof this.room.memory.links == 'undefined') { this.room.memory.links = {}; }
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
    if (this.direction() < 0) { return; }  // This is a receiver
    if (this.energy > this.free / 4) {
        // More than 25% full, transfer to the receiver with least energy
        let lo_index = null;
        let lo_energy = null;
        for (let i in this.room.links) {
            let peer = this.room.links[i];
            if (peer.id == this.id) { continue; } // Self
            if (peer.direction() < 0) { continue; } // Another receiver
            if (peer.free > 0) {
                if (lo_energy == null || peer.energy < lo_energy) {
                    lo_energy = peer.energy;
                    lo_index = i;
                }
            }
        }
        if (lo_index != null) {
            let peer = this.room.links[lo_index];
            console.log(this.room.link()+' '+this+' transferring energy to '+peer);
            this.transferEnergy(peer, Math.min(this.energy, peer.free));
        }
    }

}

StructureLink.prototype.shift_least_energy = function(objects) {
    var sorted = objects.sort( function(a,b) { return a.energy - b.energy; } );
    //console.log(sorted);
    return sorted.shift();
}

StructureLink.prototype.count_transfer = function() {
    this.room.memory.links[this.id] = ((this.room.memory.links[this.id] || 0) * 0.9) + 1;
}

StructureLink.prototype.count_withdraw = function() {
    this.room.memory.links[this.id] = ((this.room.memory.links[this.id] || 0) * 0.9) - 1;
}

StructureLink.prototype.direction = function() {
    return this.room.memory.links[this.id] || 0;
}
