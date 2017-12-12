var userPool = new function() {

    var userPoolTable;

    this.updateUserPool = function() {
        if(typeof userPoolTable != 'undefined') {
            //empty the tickets table and populate with new data from server if table is not created
            userPoolTable.fnClearTable();
            var params = servicePoint.createParams();
            params.userId = sessvars.currentUser.id;
            var tickets = spService.get("branches/"+params.branchId+"/users/"+params.userId+"/pool/visits");
            userPoolTable.fnAddData(tickets);
        } else {
            var columns = [
                /* Id */                {"bSearchable": false,
                    "bVisible": false,
                    "mDataProp": "visitId"},
                /* Ticket id */         {"sClass": "firstColumn",
                    "mDataProp": "ticketId"},
                /* Waiting time */      {"sClass": "lastColumn",
                    "mDataProp": "waitingTime"}
            ];
            var headerCallback = function(nHead, aasData, iStart, iEnd, aiDisplay) {
                if(nHead.getElementsByTagName('th')[0].innerHTML.length == 0) {
                    nHead.style.borderBottom = "1px solid #c0c0c0";
                    nHead.getElementsByTagName('th')[0].innerHTML = jQuery.i18n.prop('info.user.pool.tickets');
                    nHead.getElementsByTagName('th')[0].style.textAlign = "center";
                    nHead.getElementsByTagName('th')[1].innerHTML = jQuery.i18n.prop('info.user.pool.waiting.time');
                    nHead.getElementsByTagName('th')[1].style.textAlign = "center";
                }
            };
            var t = new Date();
            var url = "/rest/servicepoint/branches/" + sessvars.branchId + "/users/" + sessvars.currentUser.id + "/pool/visits?call=" + t;
            
            var rowCallback = function(nRow, aData, iDisplayIndex) {
                if(!(servicePoint.isOutcomeOrDeliveredServiceNeeded() /*&& sessvars.forceMark && !hasMark()*/)) {
                    //format ticket number
                    $('td:eq(0)', nRow).html("<span class='ticketNumSpan'>" + aData.ticketId + "</span>");
                } else {
                    $('td:eq(0)', nRow).addClass("ticketIdDisabled");
                }
                var formattedTime = util.formatIntoHHMM(parseInt(aData.waitingTime));
                $('td:eq(1)', nRow).html(formattedTime);
                $(nRow).addClass("");
                return nRow;
            };

            //create new table since not defined
            userPoolTable = util.buildTableJson({"tableId": "userPool", "url": url, "rowCallback": rowCallback,
                "columns": columns, "filter": false, "headerCallback": headerCallback, "scrollYHeight": "54px",
                "emptyTableLabel": "info.user.pool.no.tickets"});
        }

        //kill old event handlers
        $('tbody td span.ticketNumSpan', $('#userPool')).die('click');

        //callbacks for calling, transferring and removing tickets
        $('tbody td span.ticketNumSpan', $('#userPool')).live('click', function() {
            var nTr = $(this).closest("tr").get(0);
            var aData = userPoolTable.fnGetData(nTr);
            ticketClicked(aData);
            return false;
        });

        $(document).ready(function() {
            var sorting = [[2, 'desc']];
            userPoolTable.fnSort(sorting);
        });

        // Sadly clearing and adding data to the queue "data table" resets the position of our search result
        customer.positionCustomerResult();
    };

    this.renderUserPool = function () {
        var t = new Date();
        var url = "branches/" + sessvars.branchId + "/users/" 
                    + sessvars.currentUser.id + "/pool/visits?call=" + t;
        
        // Get Pool list and empty it
        var userPoolList = $('#userPoolList');
        userPoolList.empty();
        
        // Templates
        var userPoolItemTemplate = $('<li class="qm-pool__list-item"><div class="qm-pool-item"><a href="#" class="qm-pool-item__content qm-pool-item__content--ticket" data-toggle="popover"></a><span class="qm-pool-item__content qm-pool-item__content--wait"></span></div></li>')
        var noResultTemplate = $('<li class="qm-pool__list-item"><span class="qm-pool__no-result-text">No customers waiting</span></li>');
        var popoverTemplate = document.querySelector('.qm-popover--pool').outerHTML.trim();
        
        // Popover options
        var options = {
            template: popoverTemplate
        }

        // Get the data
        var userPoolData = spService.get(url);
        if(userPoolData.length > 0) {
            // Sort based on time in pool
            userPoolData.sort(util.compareTimeInPool);
            userPoolData.forEach(function(data, i) {
                var template = userPoolItemTemplate.clone();
                
                template.find('.qm-pool-item__content--ticket').text(data.ticketId).attr('data-visitId', data.visitId);
                template.find('.qm-pool-item__content--wait').text(util.formatIntoMM(data.waitingTime));
                userPoolList.append(template);
                

                // Popover options and initialization
                options.popTarget = template.get(0).querySelector('.qm-pool-item__content--ticket');
                if(servicePoint.isOutcomeOrDeliveredServiceNeeded()) {
                    options.disableCall = true;
                }
                var popover = new window.$Qmatic.components.popover.UserPoolPopoverComponent(options);
                popover.init();
            });
        } else {
            userPoolList.append(noResultTemplate);
        }
    };

    this.callFromPool = function (visitId) {
        if(servicePoint.hasValidSettings()) {
            var params = servicePoint.createParams();
            params.userId = sessvars.currentUser.id;
            params.visitId = visitId;
			spPoolUpdateNeeded = false;
            sessvars.state = servicePoint.getState(spService.put("branches/"+params.branchId+"/servicePoints/"+params.servicePointId+"/users/"+params.userId+"/pool/"+params.visitId));
            sessvars.statusUpdated = new Date();

            servicePoint.updateWorkstationStatus();
            sessvars.currentCustomer = null;
            customer.updateCustomerModule();
        }
    }

    var ticketClicked = function(aRowData) {
        if(servicePoint.hasValidSettings()) {
            var params = servicePoint.createParams();
            params.userId = sessvars.currentUser.id;
            params.visitId = aRowData.visitId;
			spPoolUpdateNeeded = false;
             sessvars.state = servicePoint.getState(spService.put("branches/"+params.branchId+"/servicePoints/"+params.servicePointId+"/users/"+params.userId+"/pool/"+params.visitId));
            sessvars.statusUpdated = new Date();

            servicePoint.updateWorkstationStatus();
            sessvars.currentCustomer = null;
            customer.updateCustomerModule();
        }
    };
	
	this.parkPressed = function() {
		if(servicePoint.hasValidSettings() && sessvars.state.userState == servicePoint.userState.SERVING) {
	        var params = servicePoint.createParams();
			params.userId = sessvars.currentUser.id;
			spPoolUpdateNeeded = false;
	        params.json='{"fromId":'+ sessvars.servicePointId + ',"fromBranchId":'+ sessvars.branchId + ',"visitId":' + sessvars.state.visit.id + '}';		
			spService.putParams('branches/' +  params.branchId + '/users/' +  params.userId + '/visits/',params);
            sessvars.state = servicePoint.getState();
	        sessvars.statusUpdated = new Date();
	        servicePoint.updateWorkstationStatus();
		   
		    sessvars.currentCustomer = null;
	        customer.updateCustomerModule();
		}
    };


    this.isEmpty = function() {
        var isEmpty = true;
        var params = servicePoint.createParams();
        params.userId = sessvars.currentUser.id;
        var tickets = spService.get("branches/"+params.branchId+"/users/"+params.userId+"/pool/visits");
        if(typeof tickets !== 'undefined' && tickets != null && tickets.length > 0) {
            isEmpty = false;
        }
        return isEmpty;
    };

    this.emptyPool = function() {
        userPoolTable.fnClearTable();
    }
};