/** @jsx React.DOM */

var React = require('react');

// Table component
var Table = React.createClass({
    name: 'table',
    mixins: [getCommonMixin],
    
    // attribute definitions
    // paging example: { size:10, page:2, total:25 }
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'table-container-bordered', note:'container CSS class' },
            { name:'dispatcher', type:'object', required:false, defaultValue:null, note:'flux dispatcher' },
            { name:'colModel', type:'object', required:false, defaultValue:null, note:'column model' },
            { name:'dataItems', type:'array', required:false, defaultValue:[], note:'data items' },
            { name:'paging', type:'object', required:false, defaultValue:null, note:'paging options' },
            { name:'activeItemId', type:'string', required:false, defaultValue:'', note:'the active item id' },
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
    
    onTableClick: function(event) {
        var target = $(event.target);
        if (target.hasClass('table-head-cell-content-container') ||
            target.hasClass('table-head-cell-text-container') ||
            target.hasClass('table-head-cell-sort-icon') ) {
            this.onHeadCellClick(event);
        } else if (target.hasClass('table-body-cell-container') ||
            target.hasClass('table-body-cell-content-container') ||
            target.hasClass('table-body-cell-text-container') ) {
            this.onRowClick(event);
        }
        this.fire('table-cell-click', [{ target:target }]);
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
    
    onRowClick: function(event) {
        var target = $(event.target);
        var parents = target.parents('.table-row-container');
        var rowContainer = parents && parents[0];
        // set active class for clicked row
        var tableContentContainer = target.parents('.table-content-container');
        $(tableContentContainer).find('.table-row-container').removeClass('table-row-active');
        $(rowContainer).addClass('table-row-active');
        // get row id and fire event
        var itemId = $(rowContainer).attr('data-key');
        if (itemId) {
            this.state.activeItemId = itemId;
            this.fire('table-row-click', [{ id:itemId }]);
        }
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
    
    // normalize input
    normalizeInput: function(dataItems) {
        var resultItems = [];
        dataItems = dataItems || [];
        if (typeof dataItems === 'object') {
            if (dataItems.constructor.name === 'Array') {
                // make sure content is object, otherwise convert to object
                for (var i = 0; i < dataItems.length; i++) {
                    if (typeof dataItems[i] !== 'object') {
                        resultItems.push({ value:dataItems[i] });
                    } else {
                        resultItems.push(dataItems[i]);
                    }
                }
            } else if (dataItems.constructor.name === 'Object') {
                for (var p in dataItems) {
                    resultItems.push({ name:p, value:dataItems[p] })
                }
            }
        }
        return resultItems;
    },
    
    // populate paging object
    normalizePaging: function(paging) {
        paging.start = (paging.page - 1) * paging.size + 1;
        paging.stop = paging.start + paging.size - 1;
        if (paging.stop > paging.total) {
            paging.stop = paging.total;
        }
        return paging;
    },
    
    processInput: function() {
        this.state.dataItems = this.normalizeInput(this.state.dataItems);
        // update colModel if it is empty
        if (!this.state.colModel || JSON.stringify(this.state.colModel) === '{}') {
            this.state.colModel = this.getColModel(this.state.dataItems[0]);
        }
        this.state.colModel = this.normalizeColModel(this.state.colModel);
        // find primary key field name from colModel
        this.keyColName = this.getKeyColNameFromColModel(this.state.colModel);
        // normalize paging object
        if (this.state.paging) {
            this.state.paging.total = this.state.dataItems.length;
            this.state.paging = this.normalizePaging(this.state.paging);
        }
    },
    
    // get rows for display (considering paging)
    getDisplayRows: function() {
        var rows = [];
        if (this.state.paging) {
            var start = this.state.paging.start;
            var stop = this.state.paging.stop;
            for (var i = start; i <= stop; i++) {
                rows.push(this.state.dataItems[i-1]);
            }
        } else {
            rows = this.state.dataItems;
        }
        return rows;
    },
    
    componentDidMount: function() {
        this.bindPagingbar();
    },
    
    componentDidUpdate: function() {
        this.bindPagingbar();
    },
    
    bindPagingbar: function() {
        // get pagingbar and subscribe to pagingbar events
        var pagingbar = this.refs['pagingbar'];
        pagingbar.on('pagingbar-button-click', function(event) {
            var buttonType = event && event.type;
            var paging = event && event.paging; // current paging status
            if (this.state.paging) {
                var currentPage = paging.page;
                switch (buttonType) {
                    case 'begin':
                        currentPage = 1;
                        break;
                    case 'back':
                        if (currentPage > 1) {
                            currentPage = currentPage - 1;
                        }
                        break;
                    case 'next':
                        if (currentPage < paging.pages) {
                            currentPage = currentPage + 1;
                        }
                        break;
                    case 'end':
                        currentPage = paging.pages;
                        break;
                }
            }
            this.state.paging.page = currentPage;
            // update display
            this.forceUpdate();
        }.bind(this));
    },
    
    render: function() {
        this.processInput();
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
        var displayRows = this.getDisplayRows();
        for (var i = 0; i < displayRows.length; i++) {
            var dataItem = displayRows[i];
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
            // set row key
            var bodyRowKey = 'body-row-' + (i+1) + '-';
            if (this.keyColName) {
                bodyRowKey += dataItem[this.keyColName];
            } else {
                bodyRowKey += this.generateUid();
            }
            var bodyCellRowData = {
                    type: 'body',
                    key: dataItem[this.keyColName],
                    context: { row:i+1 },
                    dataItems: bodyCellRowDataItems
                };
            cellRows.push(<TableRow data={ bodyCellRowData } key={ bodyRowKey } />);
        }
        // set pagingbar key
        var pagingbarKey = 'pagingbar-' + JSON.stringify(this.state.paging);
        var tableObject = 
            <div className={ this.state.containerClassNames.join(' ') } >
                <div className="table-content-container" onClick={ this.onTableClick } >
                    <TableRow data={ headCellRowData } />
                    { cellRows }
                </div>
                <PagingBar data={ this.state.paging } ref="pagingbar" key={ pagingbarKey } />
            </div>
        return tableObject;
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
            { name:'key', type:'string', required:false, defaultValue:'', note:'row key value' },
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
            <div className={ this.state.containerClassNames.join(' ') } data-key={ this.state.key } >
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
                style={ divStyle } >
                { content }
            </div>
        );
    }
});

// Paging toolbar
var PagingBar = React.createClass({
    name: 'pagingbar',
    mixins: [getCommonMixin],
    
    // attribute definitions
    getAttributes: function() {
        var attributes = [
            { name:'boxClass', type:'string', required:false, defaultValue:'', note:'container CSS class' },
            { name:'size', type:'number', required:true, defaultValue:10, note:'page size' },
            { name:'total', type:'number', required:true, defaultValue:0, note:'total count' },
            { name:'page', type:'number', required:true, defaultValue:1, note:'current page number' },
            { name:'start', type:'number', required:true, defaultValue:1, note:'page start' },
            { name:'stop', type:'number', required:true, defaultValue:10, note:'page end' }
        ];
        return attributes;
    },
    
    onPagingButtonClick: function(event) {
        var buttonType = '';
        var target = $(event.target);
        if (target.hasClass('btn-paging-begin')) {
            buttonType = 'begin';
        } else if (target.hasClass('btn-paging-back')) {
            buttonType = 'back';
        } else if (target.hasClass('btn-paging-next')) {
            buttonType = 'next';
        } else if (target.hasClass('btn-paging-end')) {
            buttonType = 'end';
        }
        if (buttonType) {
            var paging = {
                pages:this.state.pages,
                page:this.state.page
            };
            this.fire('pagingbar-button-click', [{ paging:paging, type:buttonType }]);
        }
    },
    
    render: function() {
        var pagingbar = null;
        if (this.state.total > 0) {
            // set content display
            this.state.pages = Math.ceil(this.state.total/this.state.size);
            var pagingStatus = this.state.page + '/' + this.state.pages;
            // add paging buttons and label display
            var content =
                <div className="pagingbar-content-container" onClick={ this.onPagingButtonClick }>
                    <i className="btn-paging btn-paging-begin fa fa-step-backward"></i>
                    <i className="btn-paging btn-paging-back fa fa-backward"></i>
                    <span className="pagingbar-label-container">{ pagingStatus }</span>
                    <i className="btn-paging btn-paging-next fa fa-forward"></i>
                    <i className="btn-paging btn-paging-end fa fa-step-forward"></i>
                </div>;
            pagingbar =
                <div className={ this.state.containerClassNames.join(' ') }>
                    { content }
                </div>;
        }
        return pagingbar;
    }
});

module.exports = Table;
