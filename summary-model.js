Ext.define('Rally.pxs.data.SummaryModel',{
    extend: 'Ext.data.Model',
    alias: 'pxssummarymodel',
    fields: [
         { name: 'ObjectID', type: 'INT' },
         { name: 'Name', type: 'STRING' },
         { name: 'FirstPlanEstimate', type: 'NUMBER', defaultValue: 0},
         { name: 'LastPlanEstimate', type: 'NUMBER', defaultValue: 0},
         { name: 'cfEffortNotAccepted', type: 'NUMBER', defaultValue:0},
         { name: 'cfFoundWork', type: 'NUMBER', defaultValue:0 },
         { name: 'ScheduleState', type: 'STRING', defaultValue: ""}
     ],
     hasMany: [{ model: 'pxsdailysnap', name: 'DailySnaps' }],
     addDailySnap: function(midnight,snap) {
        var snap_to_store = Ext.create('Rally.pxs.data.DailySnap',{
            EndDate: midnight
        });
        this.set('LastPlanEstimate', snap.get('PlanEstimate'));
        this.set('cfEffortNotAccepted', snap.get('c_cfEffortNotAccepted'));
        this.set('cfFoundWork', snap.get('c_cfFoundWork'));
        this.set('ScheduleState', snap.get('ScheduleState'));
        
        this.set(midnight.replace(/T.*$/,""), "X");
        if ( this.get('DailySnaps') ) {
            this.get('DailySnaps').push(snap_to_store);
        } else {
            this.set('DailySnaps',[snap_to_store]);
        }
    },
    getSnapByDate: function(snap_date) {
        var snap = null;
        var me = this;
        Ext.Array.each(me.get('DailySnaps'), function(potential_snap){
            if (potential_snap.get('EndDate') === snap_date ) {
                snap = potential_snap;
            }
        });
        return snap;
    }
});