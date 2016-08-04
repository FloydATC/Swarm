
module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.free = this.energyCapacity - this.energy;
        this.room.link_count++;
        this.room.link_total += this.energy;
        this.room.link_average = this.room.link_total / this.room.link_count;
    },

    execute: function() {
        if (this.cooldown > 0) { return; } // Unable to transfer
        if (this.energy <= this.room.link_average) { return; } // We should receive, not transmit
        var xmit_total = this.energy - this.room.link_average;
        var recv_total = 0;
        var peer = this.shift_least_energy(this.room.links.clone());
        var amount = this.room.link_average - peer.energy;
        console.log(this.room+' '+this+' transferring '+amount+' to '+peer);
        this.transferEnergy(peer, amount);
    },

    shift_least_energy: function(objects) {
        objects = objects.sort( function(a,b) { a.energy - b.energy } );
        return objects.shift();
    },
};
