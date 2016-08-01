

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        this.energy = this.store.energy;
        this.free = this.storeCapacity - _.sum(this.store);
    },

};
