Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    defaults: { padding: 5 },
    items: [
        {xtype:'container', itemId: 'iteration_selector_box'},
        {xtype:'container',itemId:'summary_grid_box'},
        {xtype: 'container', itemId: 'separator', margin: 25, padding: 25, html: "--" },
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
        
        if ( this.summary_grid ) { this.summary_grid.destroy(); }
        if ( this.down('#artifact_grid') ) { this.down('#artifact_grid').destroy(); }

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
                'c_cfEffortNotAccepted','c_cfFoundWork','ScheduleState'
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
                                cfEffortNotAccepted: snap.get('c_cfEffortNotAccepted'),
                                cfFoundWork: snap.get('c_cfFoundWork'),
                                ScheduleState: snap.get('ScheduleState')
                            });
                        }
                        me.artifacts[snap.get('ObjectID')].addDailySnap(midnight,snap);
                    });
                    if ( date_array.length > 0 ) {
                        this._getEndOfOneDaySnaps(date_array,iteration_ids);
                    } else {
                        this._showSummary();
                        this._showDetails();
                    }
                },
                scope: this
            }
        });
    },
    _wasThereOnDayOne: function(artifact) {
        var there_on_day_one = false;
        if (artifact.getSnapByDate(this.date_array[0])){
            there_on_day_one = true;
        }
        return there_on_day_one;
    },
    _showSummary:function() {
        window.console && console.log("_showSummary",this.date_array[0],this.artifacts);
        var me = this;
        var original_commitment = 0;
        var velocity = 0;
        var effort = 0;
        var found_estimate = 0;
        var adopted_estimate = 0;
        for (var artifact_id in this.artifacts ) {
            if ( this.artifacts.hasOwnProperty(artifact_id)) {
                var artifact = this.artifacts[artifact_id];
                
                if ( me._wasThereOnDayOne(artifact) ) {
                    original_commitment += artifact.get('FirstPlanEstimate');
                }
                found_estimate += artifact.get('cfFoundWork');
                
                if ((artifact.get('ScheduleState') === "Accepted")&&(me._wasThereOnDayOne(artifact)) ) {
                    velocity += artifact.get('FirstPlanEstimate');
                }
                if (artifact.get('ScheduleState') !== "Accepted"){
                    effort += artifact.get('cfEffortNotAccepted');
                }
                if (!me._wasThereOnDayOne(artifact)){
                    adopted_estimate += artifact.get('LastPlanEstimate');
                }
            }
        }
        
        var pass_fail = "PASS";
        
        if ( ( ( adopted_estimate + found_estimate ) / original_commitment ) > 0.2 ) {
            pass_fail = "FAIL";
        }
        if (( velocity / original_commitment ) < 0.8 ) {
            pass_fail = "FAIL";
        }
        var data = [{ 
            original_commitment: "&Sigma;estimate day one",
            velocity: "&Sigma;estimate day one for accepted",
            effort: "&Sigma;cfEffortNotAccepted for not accepted",
            found_estimate: "&Sigma;cfFoundWork",
            adopted_estimate: "&Sigma;estimate items not on day one",
            capacity_estimate: "velocity+estimate",
            total_commitment: "original commitment + adopted estimate + found estimate",
            focus_factor: "velocity/(velocity+effort)",
            adopted_work: "adopted estimate/original commitment",
            found_work: "found estimate/original commitment",
            commitment_accuracy: "(orig_commitment + adopted_est + found_est) / orig_commitment",
            pass_fail: "( ( adopted_estimate + found_estimate ) / original_commitment ) > 0.2  OR ( velocity / original_commitment ) < 0.8"
        },
        { 
            original_commitment: original_commitment,
            velocity: velocity,
            effort: effort,
            found_estimate: found_estimate,
            adopted_estimate: adopted_estimate,
            capacity_estimate: velocity + effort,
            total_commitment: original_commitment + adopted_estimate + found_estimate,
            focus_factor: velocity / (velocity + effort),
            adopted_work: adopted_estimate / original_commitment,
            found_work: found_estimate / original_commitment,
            commitment_accuracy: ( original_commitment + adopted_estimate + found_estimate ) / original_commitment,
            pass_fail: pass_fail
        }];
        
        var columns = [
            {text:'Original Commitment',dataIndex:'original_commitment'},
            {text:'Velocity',dataIndex:'velocity'},
            {text:'Effort Not Accepted',dataIndex:'effort'},
            {text:'Found Estimate', dataIndex: 'found_estimate' },
            {text:'Adopted Estimate', dataIndex: 'adopted_estimate'},
            {text:'Capacity', dataIndex: 'capacity_estimate'},
            {text:'Total Commitment', dataIndex: 'total_commitment'},
            {text:'Focus Factor', dataIndex: 'focus_factor'},
            {text:'Adopted Work', dataIndex: 'adopted_work'},
            {text:'Found Work', dataIndex: 'found_work'},
            {text:'Commitment Accuracy', dataIndex: 'commitment_accuracy'},
            {text:'Pass/Fail', dataIndex: 'pass_fail' }
        ];
        
        var store = Ext.create('Rally.data.custom.Store',{data: data});
        this.summary_grid = Ext.create('Rally.ui.grid.Grid',{
            showPagingToolbar: false,
            store:store,columnCfgs:columns}
        );
        this.down('#summary_grid_box').add(this.summary_grid);
    },
    _showDetails:function(){
        window.console && console.log(this.date_array[0],this.artifacts);
        var temp_array = [];
        var me = this;
        var columns = [
            {text: "Name", dataIndex: "Name", flex: 1 },
            {text: "OriginalEstimate", dataIndex: 'FirstPlanEstimate'},
            {text: "LastEstimate", dataIndex: 'LastPlanEstimate'},
            {text: "ScheduleState", dataIndex: 'ScheduleState'},
            {text: 'cfEffortNotAccepted', dataIndex: 'cfEffortNotAccepted'},
            {text: 'cfFoundWork', dataIndex: 'cfFoundWork'}
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
            itemId: 'artifact_grid',
            store: store,
            columnCfgs: columns
        });
        
    }
});
