
module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.free = this.energyCapacity - this.energy;
        this.room.link_count++;
        this.room.link_total += this.energy;
        this.room.link_average = Math.floor(this.room.link_total / this.room.link_count);
    },

    execute: function() {
        //console.log(this+' execute() with energy='+this.energy+' average='+this.room.link_average);
        if (this.cooldown > 0) { return; } // Unable to transfer
        if (this.energy <= this.room.link_average) { return; } // We should receive, not transmit
        var peer = this.shift_least_energy(this.room.links.slice());
        //console.log('  peer '+peer+' has '+peer.energy+' energy');
        var amount = this.room.link_average - peer.energy;
        if (amount >= 50) {
            console.log(this.room+' '+this+' transferring '+amount+' to '+peer);
            this.transferEnergy(peer, amount);
        }
    },

    shift_least_energy: function(objects) {
        var sorted = objects.sort( function(a,b) { return a.energy - b.energy; } );
        //console.log(sorted);
        return sorted.shift();
    },
};
