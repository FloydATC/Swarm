

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');

        // Calculate and set spawn parameters for feeder
        this.memory.lead_time = 10; // How many ticks from spawn to arrival? FIXME!!!
        this.memory.cooldown = 300; // How many ticks minimum between spawns? FIXME!!!
        this.memory.workforce = { 'Feeder': 2 };

        this.initialize_tc();
    },

};
