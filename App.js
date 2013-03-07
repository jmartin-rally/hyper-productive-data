Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    defaults: { padding: 5 },
    items: [
        {xtype:'container', itemId: 'iteration_selector_box'},
        {xtype:'container',itemId:'summary_grid_box'},
        {xtype:'container',itemId:'artifact_grid_box'}
    ],
    artifacts: [],
    date_array: [],
    launch: function() {
        this._addIterationSelector();
    },
    _addIterationSelector: function() {
        this.down('#iteration_selector_box').add({ 
            xtype:'rallyiterationcombobox', 
            listeners: {
                change: function(box,newValue) {
                   // raw value is name, newValue is /iteration/{objectid}
                   this._getIterations(box.getRawValue());
                },
                ready: function(box) {
                   this._getIterations(box.getRawValue());
                },
                scope: this
            }
        });
    },
    _getIterations: function(iteration_name) {
        window.console && console.log(iteration_name);
        this.artifacts = {};
        this.date_array = [];
        
        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad: true,
            fetch: ['ObjectID','EndDate','StartDate'],
            model: 'Iteration',
            filters: { property: 'Name', operator: '=', value: iteration_name },
            listeners: { 
                load: function(store,data,success) {
                    this._getEndOfDaySnaps(data);
                },
                scope: this
            }
        });
    },
    _getEndOfDaySnaps: function(iterations) {
        window.console && console.log("_getEndOfDaySnaps", iterations);
            // find artifacts in the sprint at the end of each day
        if (iterations.length > 0) {
            var iteration_start = iterations[0].get('StartDate');
            var iteration_end = iterations[0].get('EndDate');
            var date_array = [];
            var midnight = iteration_start;
            while ( midnight < iteration_end ) {
                midnight = Rally.util.DateTime.add(midnight,"day",1);
                date_array.push(Rally.util.DateTime.toIsoString(midnight,false));
            }
            var iteration_ids = [];
            Ext.Array.each(iterations,function(iteration){
                iteration_ids.push( iteration.get('ObjectID'));
            });
            this.date_array = Ext.Array.clone(date_array);
            this._getEndOfOneDaySnaps(date_array,iteration_ids);
        } else {
            window.console && console.log("no sprints found");
        }
    },
    _getEndOfOneDaySnaps: function(date_array,iteration_ids) {
        window.console && console.log( "_getEndOfOneDaySnaps");
        var midnight = date_array.shift();
        var query = [{property:'Iteration',operator:'in',value:iteration_ids},{property:'__At',value:midnight}];
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            fetch: [
                '_PreviousValues','Iteration','ObjectID','Name','PlanEstimate',
                'cf_EffortNotAccepted','cf_FoundWork','ScheduleState'
            ],
            hydrate: ['ScheduleState'],
            filters: query,
            listeners: {
                load: function(store,data,success) {
                    window.console && console.log(data);
                    var me = this;
                    Ext.Array.each(data,function(snap) {
                        if (!me.artifacts[snap.get('ObjectID')]){
                            me.artifacts[snap.get('ObjectID')] = Ext.create('Rally.pxs.data.SummaryModel',{
                                Name: snap.get('Name'),
                                ObjectID: snap.get('ObjectID'),
                                FirstPlanEstimate: snap.get('PlanEstimate'),
                                cf_EffortNotAccepted: snap.get('cf_EffortNotAccepted'),
                                cf_FoundWork: snap.get('cf_FoundWork')
                            });
                        }
                        me.artifacts[snap.get('ObjectID')].addDailySnap(midnight,snap);
                    });
                    if ( date_array.length > 0 ) {
                        this._getEndOfOneDaySnaps(date_array,iteration_ids);
                    } else {
                        this._doSomething();
                    }
                },
                scope: this
            }
        });
    },
    _doSomething:function(){
        window.console & console.log(this.date_array[0],this.artifacts);
        var temp_array = [];
        var me = this;
        var columns = [
            {text: "Name", dataIndex: "Name", flex: 1 },
            {text: "OriginalEstimate", dataIndex: 'FirstPlanEstimate'},
            {text: "LastEstimate", dataIndex: 'LastPlanEstimate'},
            {text: 'cf_EffortNotAccepted', dataIndex: 'cf_EffortNotAccepted'},
            {text: 'cf_FoundWork', dataIndex: 'cf_FoundWork'}
        ];
        Ext.Array.each( this.date_array, function(midnight){
            var stripped_date = midnight.replace(/T.*$/,"");
            columns.push({ text: "Is in " + stripped_date, dataIndex: stripped_date });
        });
        for ( var id in me.artifacts ) {
            if ( me.artifacts.hasOwnProperty(id) ){
                window.console && console.log( me.artifacts[id] );
                temp_array.push(me.artifacts[id]);
            }
        }
        var store = Ext.create('Rally.data.custom.Store',{
            data: temp_array,
            model: 'pxssummarymodel'
        });
        
        this.down('#artifact_grid_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: columns
        });
        
    },
    _getSnapshots: function(iteration_ids) {
        window.console && console.log("_getSnapshots", iteration_ids);
        // find artifacts that entered or left the iteration
        var query = [];
        query.push({property: 'Iteration', operator: 'in', value: iteration_ids});
        Ext.create('Rally.data.lookback.SnapshotStore', {
           autoLoad: true,
           fetch: ['_PreviousValues','Iteration','ObjectID','Name'],
           filters: query,
           listeners: {
                load: function(store,data,success) {
                    window.console && console.log(data);
                    Ext.Array.each( data, function(snap){
                        // only care about the times at which the change happened
                        if (typeof(snap.get('_PreviousValues').Iteration) !== "undefined") {
                            window.console && console.log(typeof(snap.get('_PreviousValues').Iteration),snap.get('_PreviousValues').Iteration,snap.get('Iteration'),snap.get('Name'));
                        }
                    });
                }
           }
        });
    }
});
