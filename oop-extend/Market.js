
Market.prototype.initialize = function() {
    console.log(this+' initializing');
    if (typeof Memory.m == 'undefined') { Memory.m = {}; }
    this.memory = Memory.m;

    this.targets = {
        RESOURCE_HYDROGEN: 1000,
        RESOURCE_KEANIUM: 1000,
        RESOURCE_OXYGEN: 1000,
        RESOURCE_HYDROXIDE: 1000,
        RESOURCE_KEANIUM_ACID: 1000,
    };

    this.all_orders = Game.market.getAllOrders();
    console.log(this+' initialized ok');
}
