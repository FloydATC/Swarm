

module.exports = {}; // Nothing

StructureStorage.prototype.initialize = function() {
    //console.log(this+' initializing');

    this.energy = this.store.energy;
    this.free = this.storeCapacity - _.sum(this.store);
    this.reserved_amount = 0;
    this.energy_pct = this.energy * 100 / this.storeCapacity;
}
