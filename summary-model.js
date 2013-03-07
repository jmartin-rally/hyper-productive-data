Ext.define('Rally.pxs.data.SummaryModel',{
    extend: 'Ext.data.Model',
    alias: 'pxssummarymodel',
    fields: [
         { name: 'ObjectID', type: 'INT' },
         { name: 'Name', type: 'STRING' },
         { name: 'FirstPlanEstimate', type: 'NUMBER', defaultValue: 0},
         { name: 'LastPlanEstimate', type: 'NUMBER', defaultValue: 0},
         { name: 'cf_EffortNotAccepted', type: 'NUMBER', defaultValue:0},
         { name: 'cf_FoundWork', type: 'NUMBER', defaultValue:0 }
     ],
     hasMany: [{ model: 'pxsdailysnap', name: 'DailySnaps' }],
     addDailySnap: function(midnight,snap) {
        var snap_to_store = Ext.create('Rally.pxs.data.DailySnap',{
            EndDate: midnight
        });
        this.set('LastPlanEstimate', snap.get('PlanEstimate'));
        this.set('cf_EffortNotAccepted', snap.get('cf_EffortNotAccepted'));
        this.set('cf_FoundWork', snap.get('cf_FoundWork'));
        
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
            if (potential_snap.getDate() === snap_date ) {
                snap = potential_snap;
            }
        });
        return snap;
    }
});