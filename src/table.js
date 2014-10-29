// Table component
var Table = React.createClass({
    name: 'table',
    mixins: [getCommonMixin],
    
    // attribute definitions
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'', note:'container CSS class' },
            { name:'colModel', type:'object', required:false, defaultValue:null, note:'column model' },
            { name:'dataItems', type:'array', required:false, defaultValue:[], note:'data items' },
            { name:'text', type:'string', required:false, defaultValue:'', note:'display text' }
        ];
        return attributes;
    },
    
    // deduce column model from data item
    getColModel: function(dataItem) {
        var colModel = {};
        for (var property in dataItem) {
            var colModelItem = {};
            colModelItem.text = property;
            colModelItem.name = property.toLowerCase();
            colModel[colModelItem.name] = colModelItem;
        }
        return colModel;
    },
    
    onClick: function(event) {
        var target = $(event.target);
        if (target.hasClass('table-head-cell-content-container') ||
            target.hasClass('table-head-cell-text-container') ||
            target.hasClass('table-head-cell-sort-icon') ) {
            this.onHeadCellClick(event);
        }
    },
    
    onHeadCellClick: function(event) {
        var target = $(event.target);
        var parents = target.parents('.table-head-cell-container');
        var headCellContainer = parents && parents[0];
        var modelName = $(headCellContainer).attr('data-model-name');
        // set sort value for column
        switch(this.state.colModel[modelName].sort) {
        case '':
        case 'none':
            this.state.colModel[modelName].sort = 'up';
            break;
        case 'up':
            this.state.colModel[modelName].sort = 'down';
            break;
        case 'down':
            this.state.colModel[modelName].sort = 'up';
            break;
        }
        // if only one column can be sorted, remove sort value on other columns
        for (var name in this.state.colModel) {
            if (name !== modelName) {
                this.state.colModel[name].sort = '';
            }
        }
        // sort data
        var sortCondition = {
            name:modelName,
            direction:this.state.colModel[modelName].sort
        };
        this.state.dataItems = this.sortData(this.state.dataItems, sortCondition);
        // update display
        this.forceUpdate();
    },
    
    /*
    model property:
        name - column name, matching peorpty name of data item
        text - column as display text
        show - show column or not
        width - column width, 30% or 30px
        key - true for being primary key column
        format - format for column value, could be string or function
        sort - sort order, asc/up or des/down
    colModel example:
    [
        id: { name:'id', text:'ID', width:'15%', key:true, format:app.getIdText },
        name: { name:'name', text:'Name', width:'20%' },
        price: { name:'price', text:'Price', width:'15%', type:'money' },
        description: { name:'description', text:'Description', width:'30%' }
    ]
    */
    normalizeColModel: function(colModel) {
        for (var name in colModel) {
            var colModelItem = colModel[name];
            colModelItem.name = colModelItem.name || colModelItem.text.toLowerCase();
            colModelItem.key = colModelItem.key || false;
            if (typeof colModelItem.show === 'undefined') {
                colModelItem.show = true;
            }
            if (typeof colModelItem.sort === 'undefined') {
                colModelItem.sort = 'none';
            }
        }
        return colModel;
    },
    
    componentWillMount: function() {
        // update colModel
        if (!this.state.colModel) {
            this.state.colModel = this.getColModel(this.state.dataItems[0]);
        }
        this.state.colModel = this.normalizeColModel(this.state.colModel);
        // find primary key field name from colModel
        this.keyColName = this.getKeyColNameFromColModel(this.state.colModel);
        //console.log('colModel:', this.state.colModel);
    },
    
    render: function() {
        // populate head cells
        var headCellRowDataItems = [];
        for (var property in this.state.colModel) {
            var colModelItem = this.state.colModel[property];
            // only show column with show=true
            if (colModelItem.show) {
                headCellRowDataItems.push(colModelItem);
            }
        }
        var headCellRowData = {
            type: 'head',
            dataItems: headCellRowDataItems
        };
        // populate body cells
        var cellRows = [];
        for (var i = 0; i < this.state.dataItems.length; i++) {
            var dataItem = this.state.dataItems[i];
            var cellRow = [];
            var bodyCellRowDataItems = [];
            for (var property in this.state.colModel) {
                var colModelItem = this.state.colModel[property];
                // only show column with show=true
                if (colModelItem.show) {
                    var bodyCellData = {
                        text:dataItem[property],
                        context: { row:0 },
                        model:colModelItem
                    };
                    bodyCellRowDataItems.push(bodyCellData);
                }
            }
            var bodyCellRowData = {
                    type: 'body',
                    context: { row:i+1 },
                    dataItems: bodyCellRowDataItems
                };
            // set row key
            var bodyRowKey = 'body-row-' + (i+1) + '-';
            if (this.keyColName) {
                bodyRowKey += dataItem[this.keyColName];
            } else {
                bodyRowKey += this.generateUid();
            }
            cellRows.push(<TableRow data={ bodyCellRowData } key={ bodyRowKey } />);
        }
        
        return (
            <div className={ this.state.containerClassNames.join(' ') }
                onClick={ this.onClick }
                >
                <TableRow data={ headCellRowData } />
                { cellRows }
            </div>
        );
    }
});

// TableRow component
var TableRow = React.createClass({
    name: 'table-row',
    mixins: [getCommonMixin],
    
    // attribute definitions
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'', note:'container CSS class' },
            { name:'type', type:'string', required:false, defaultValue:'body', note:'row type: head/body' },
            { name:'context', type:'object', required:false, defaultValue:{}, note:'row context' },
            { name:'dataItems', type:'array', required:false, defaultValue:'', note:'data items' }
        ];
        return attributes;
    },
    
    render: function() {
        // prepare items in row
        var rowContent = [];
        for (var i = 0; i < this.state.dataItems.length; i++) {
            var dataItem = this.state.dataItems[i];
            switch(this.state.type) {
            case 'head':
                var cellKey = 'head-cell-' + i + '-' + dataItem.sort;
                dataItem.context = { row:0, col:i + 1 };
                rowContent.push(
                    <TableHeadCell data={ dataItem } key={ cellKey }/>
                );
                break;
            case 'body':
                var cellKey = 'body-cell-' + i;
                var row = this.state.context.row;
                dataItem.context = { row:row, col:i + 1 };
                rowContent.push(
                    <TableBodyCell data={ dataItem } key={ cellKey }/>
                );
                break;
            }
        }
        // set content display
        return (
            <div className={ this.state.containerClassNames.join(' ') } >
                { rowContent }
                <div className="div-clear-both"></div>
            </div>
        );
    }
});

// Table cell mixin
var getCellMixin = {
    // example width input: '80px', '10%'
    getWidthStyle: function(width) {
        var result = null;
        if (width) {
            result = {
                width: width
            };
        }
        return result;
    },
    getTextFromModel: function(input, model) {
        var result = input;
        //check model type
        if (model.type == 'money') {
            result =  '$' + input;
        }
        // check model format
        if (model.format && model.format.constructor.name === 'Function') {
            result = model.format(input);
        }
        return result;
    }
};

// Table Head Cell
var TableHeadCell = React.createClass({
    name: 'table-head-cell',
    mixins: [getCommonMixin, getCellMixin],
    
    // attribute definitions
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'', note:'container CSS class' },
            { name:'context', type:'object', required:false, defaultValue:{}, note:'cell context' },
            { name:'name', type:'string', required:false, defaultValue:'', note:'model name' },
            { name:'width', type:'string', required:false, defaultValue:'', note:'cell width' },
            { name:'sort', type:'string', required:false, defaultValue:'', note:'sort value' },
            { name:'text', type:'string', required:false, defaultValue:'', note:'display text' }
        ];
        return attributes;
    },
    
    render: function() {
        
        // change icon class base on model item's sort value
        var sortIconClass = '';
        switch(this.state.sort) {
        case 'up':
            sortIconClass = 'fa fa-sort-up';
            break;
        case 'down':
            sortIconClass = 'fa fa-sort-down';
            break;
        case 'none':
            sortIconClass = 'sort-spacer-icon'
            break;
        }
        this.state.sortIconClassNames = ['table-head-cell-sort-icon', sortIconClass];
        
        // get width style from mixin
        var divStyle = this.getWidthStyle(this.state.width);
        
        // set content display
        var content =
            <div className="table-head-cell-content-container" >
                <span className="table-head-cell-text-container">{ this.state.text }</span>
                <i className={ this.state.sortIconClassNames.join(' ') } ></i>
            </div>;
        return (
            <div className={ this.state.containerClassNames.join(' ') }
                data-model-name={ this.state.name }
                style={ divStyle } >
                { content }
            </div>
        );
    }
});

// Table Body Cell
var TableBodyCell = React.createClass({
    name: 'table-body-cell',
    mixins: [getCommonMixin, getCellMixin],
    
    // attribute definitions
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'', note:'container CSS class' },
            { name:'context', type:'object', required:false, defaultValue:'', note:'cell context' },
            { name:'model', type:'object', required:false, defaultValue:null, note:'cell column model' },
            { name:'text', type:'string', required:false, defaultValue:'', note:'display text' }
        ];
        return attributes;
    },
    
    render: function() {
        // get width style from mixin
        var divStyle = this.getWidthStyle(this.state.model.width);
        
        // set content display
        var displayText = this.getTextFromModel(this.state.text, this.state.model);
        displayText = displayText || '\u00A0';
        var content =
            <div className="table-body-cell-content-container" >
                <span className="table-body-cell-text-container">{ displayText }</span>
            </div>;
        return (
            <div className={ this.state.containerClassNames.join(' ') }
                data-model-name={ this.state.model.name }
                style={ divStyle }
                >
                { content }
            </div>
        );
    }
});
