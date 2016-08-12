

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');

        this.slots = this.find_slots();
        //this.initialize_tc();
    },

    find_slots: function() {
        // A free space around a Source (where a creep might mine from) counts as a "slot".
        // Count them to see how many creeps may mine this source simultaneously
        var slots = [];
        var tiles = this.room.lookForAtArea(LOOK_TERRAIN, this.pos.y-1, this.pos.x-1, this.pos.y+1, this.pos.x+1, true); // Note: YX not XY
        var count = tiles.length;
        for (var i=0; i<count; i++) {
            if (tiles[i].terrain != 'wall') { slots.push(tiles[i]); }
        }
        return slots; // Array of tiles with .terrain, .x and .y
    },

};
