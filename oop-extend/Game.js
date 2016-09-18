

module.exports = {

    initialize: function() {

        // Initialize market code
        if (typeof Memory.m == 'undefined') { Memory.m = {}; }
        this.memory = Memory.m;
        this.market_targets = {};
        this.market_targets[RESOURCE_ENERGY]        = 10000;
        this.market_targets[RESOURCE_HYDROGEN]      = 1000;
        this.market_targets[RESOURCE_KEANIUM]       = 1000;
        this.market_targets[RESOURCE_OXYGEN]        = 1000;
        this.market_targets[RESOURCE_HYDROXIDE]     = 1000;
        this.market_targets[RESOURCE_KEANIUM_ACID]  = 1000;
        this.market_price = Memory.m;
        if (typeof this.market_price == 'undefined') { this.market_price = {}; }
        this.all_orders = Game.market.getAllOrders();
        let last_tick = Game.time-1;
        this.new_orders = _.filter(this.all_orders, { created: last_tick });

        this.partial_orders = _.filter(this.all_orders, function(order) { return order.amount > order.remainingAmount } );
        // Calculate weighted average buy/sell prices based on volume
        if (this.partial_orders.length > 0) {
            let transactions = {};
            console.log('Processing '+this.partial_orders.length+' partially filled market orders');
            for (let i in this.partial_orders) {
                let order = this.partial_orders[i];
                //console.log(JSON.stringify(order));
                let sold = order.amount - order.remainingAmount;
                if (sold > 0) {
                    let total = transactions[order.resourceType];
                    if (typeof total == 'undefined') { total = { units: 0, price: 0 }; }
                    total[price] = ((total[price] * total[units]) + (order.price * sold)) / (total[units] + sold);
                    total[units] += sold;
                    console.log('Market activity: '+sold+' '+order.resourceType+' sold for '+order.price+', trend='+total[price]);
                    transactions[order.resourceType] = total;
                }
            }
            for (let resource in transactions) {
                let total = transactions[resource];
                this.market_price[resource] = (((this.market_price[resource] || total[price]) * 99) + (total[price])) / 100;
                console.log('updated moving average for '+resource+' to '+this.market_price[resource]);
            }
            Memory.m = this.market_price;
        }

        //console.log(this+' initializing');
        for (var name in this.rooms) {
            var room = this.rooms[name];
            room.initialize();
        }

        // Act on flags
        for (var name in this.flags) {
            var flag = this.flags[name];
            flag.initialize();
            //console.log(this+' flag '+flag+' type '+flag.type()+' at '+flag.pos);

            // Remote mine sources tagged with a "harvest" flag
            if (flag.type() == 'harvest') {
                // Find nearest room with an owned controller
                //console.log('Assigning owner room to flag '+flag);
                var lo_range = null;
                var lo_room = null;
                for (var name in this.rooms) {
                    var room = this.rooms[name];
                    if (room.controller && room.controller.my == true && room.controller.level > 2) {
                        var range = this.manhattanDistance(flag.pos.roomName, room.name);
                        //console.log('  candidate room '+room+' range is '+range);
                        if (lo_range == null || range < lo_range) {
                            lo_range = range;
                            lo_room = room;
                        }
                    }
                }
                //console.log('  assigned to room '+room);
                if (typeof flag.memory == 'undefined') { flag.memory = {}; }
                flag.memory.owner = lo_room.name;
                // Add this flag to that room
                if (!lo_room.harvest_flags) { lo_room.harvest_flags = []; }
                lo_room.harvest_flags.push(flag);

                // Calculate and set spawn parameters
                var lead = flag.memory.lead_time || 250; // Est.time from spawn command to flag reached
                var rtt = flag.memory.rtt || (lead * 2); // rtt becomes available only after a fetcher has completed a cycle
                //rtt = 200;
                var capacity = 500; // Assumes 10 carry parts
                var fetchers = Math.floor((CREEP_LIFE_TIME * SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME) / ((capacity * CREEP_LIFE_TIME) / rtt));
                if (flag.room && flag.room.total_dropped_energy) {
                    // React to excess energy on the floor -- indicates temporary fetcher shortage
                    fetchers += Math.floor(flag.room.total_dropped_energy / 2000);
                }

                flag.memory.cooldown = Math.floor(CREEP_LIFE_TIME / (fetchers+1)); // How many ticks minimum between spawns? FIXME!!!
                flag.memory.workforce = { 'Miner': 1, 'Fetcher': fetchers };

                //flag.memory.frequency = 250; // TTL / 6
                //flag.memory.ticks = (flag.memory.ticks + 1) || 0;
            }

            // Remote mine sources tagged with a "harvest" flag
            if (flag.type() == 'reserve') {
                // Find nearest room with an owned controller
                //console.log('Assigning owner room to flag '+flag);
                var lo_range = null;
                var lo_room = null;
                for (var name in this.rooms) {
                    var room = this.rooms[name];
                    if (room.controller && room.controller.my == true && room.controller.level > 6) {
                        var range = this.manhattanDistance(flag.pos.roomName, room.name);
                        //console.log('  candidate room '+room+' range is '+range);
                        if (lo_range == null || range < lo_range) {
                            lo_range = range;
                            lo_room = room;
                        }
                    }
                }
                //console.log('  assigned to room '+room);
                if (typeof flag.memory == 'undefined') { flag.memory = {}; }
                flag.memory.owner = lo_room.name;
                // Add this flag to that room
                if (!lo_room.reserve_flags) { lo_room.reserve_flags = []; }
                lo_room.reserve_flags.push(flag);

                // Calculate and set spawn parameters
                var lead = flag.memory.lead_time || 250; // Est.time from spawn command to flag reached

                flag.memory.cooldown = 300;
                flag.memory.workforce = { 'Reserver': 1 };

                //flag.memory.frequency = 250; // TTL / 6
                //flag.memory.ticks = (flag.memory.ticks + 1) || 0;
            }

            // All owned controllers should have a flag. Non-owned should not.
            if (flag.type() == 'controller') {
                if (flag.memory.controller) {
                    var ctrl = Game.getObjectById(flag.memory.controller);
                    if (ctrl == null || ctrl.my == false) {
                        flag.remove();
                        continue;
                    }
                    ctrl.flag = flag;

                    // Calculate and set spawn parameters
                    //flag.memory.lead_time = 20; // How many ticks from spawn to arrival? FIXME!!!
                    flag.memory.cooldown = 600; // How many ticks minimum between spawns? FIXME!!!
                    flag.memory.workforce = { 'Zealot': 1 };
                }
            }

            // All sources in owned rooms should have a flag. Non-owned should not.
            if (flag.type() == 'source') {
                if (flag.memory.source) {
                    var source = Game.getObjectById(flag.memory.source);
                    if (source == null || source.room == null || source.room.controller == null || source.room.controller.my == false) {
                        flag.remove();
                        continue;
                    }
                    source.flag = flag;
                    if (typeof source.room.source_flags == 'undefined') { source.room.source_flags = []; }
                    source.room.source_flags.push(flag);

                    // Calculate and set spawn parameters
                    //flag.memory.lead_time = 20; // How many ticks from spawn to arrival? FIXME!!!
                    flag.memory.cooldown = 200; // How many ticks minimum between spawns? FIXME!!!
                    flag.memory.workforce = { 'Miner': 1 };
                }
            }

            // All extractors in owned rooms should have a flag. Non-owned should not.
            if (flag.type() == 'extract') {
                if (flag.memory.extractor) {
                    var extractor = Game.getObjectById(flag.memory.extractor);
                    if (extractor == null || extractor.room == null || extractor.room.controller == null || extractor.room.controller.my == false) {
                        flag.remove();
                        continue;
                    }
                    extractor.flag = flag;
                    if (typeof extractor.room.extractor_flags == 'undefined') { extractor.room.extractor_flags = []; }
                    extractor.room.extractor_flags.push(flag);

                    // Calculate and set spawn parameters
                    //flag.memory.lead_time = 20; // How many ticks from spawn to arrival? FIXME!!!
                    flag.memory.cooldown = 200; // How many ticks minimum between spawns? FIXME!!!
                    flag.memory.workforce = { 'Extractor': 1 };
                }
            }

            // Colonize rooms with "spawn" flag
            if (flag.type() == 'spawn') {
                var room_name = flag.pos.roomName;
                if (Game.rooms[room_name] && Game.rooms[room_name].controller && Game.rooms[room_name].controller.my) {
                    var result = Game.rooms[room_name].createConstructionSite(flag.pos, STRUCTURE_SPAWN);
                    if (result == OK) {
                        flag.remove();
                    } else {
                        console.log(this+' createConstructionSite('+flag.pos+', STRUCTURE_SPAWN) result='+result);
                    }
                } else {
                    Game.colonize = flag.pos.roomName;
                }
            }

            // Place tower at "tower" when possible
            if (flag.type() == 'tower') {
                var room_name = flag.pos.roomName;
                if (Game.rooms[room_name] && Game.rooms[room_name].controller && Game.rooms[room_name].controller.my && Game.rooms[room_name].controller.level >= 3) {
                    var result = Game.rooms[room_name].createConstructionSite(flag.pos, STRUCTURE_TOWER);
                    if (result == OK) {
                        flag.remove();
                    } else {
                        console.log(this+' createConstructionSite('+flag.pos+', STRUCTURE_TOWER) result='+result);
                    }
                }
            }
        }


    },

    manhattanDistance: function(r1, r2) {
        // The Manhattan distance between two rooms, calculated from the names.
        // = same as linear distance except no diagonal moves allowed (as is the actual case)
        var regex = /([EW])(\d+)([NS])(\d+)/;
        var r1_parts = regex.exec(r1);
        var r2_parts = regex.exec(r2);
        //console.log(r1+' parts: '+JSON.stringify(r1_parts));
        //console.log(r2+' parts: '+JSON.stringify(r2_parts));
        if (r1_parts == null || r2_parts == null) { return 0; } // This happens in simulator
        if (r1_parts[1] != r2_parts[1]) { r1_parts[2] = r1_parts[2] * -1 } // East is opposite of west
        if (r1_parts[3] != r2_parts[3]) { r1_parts[4] = r1_parts[4] * -1 } // North is opposite of south
        return Math.abs(r1_parts[2] - r2_parts[2]) + Math.abs(r1_parts[4] - r2_parts[4]);
    },
};
