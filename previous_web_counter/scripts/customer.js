/**
 *
 * TODO: Add confirmation messages for customer actions, e.g.
 * "Success, customer updated".
 */
var customer = new function() {
	
	var customerDbOnline = true;

	var isDefined = function(object) {
        return object !== null && object !== undefined;
	};

    /*
        The locale identifier we get may contain a country identifier which may not exist among the
        supported date picker regions, so we need to try get by language identifier if a direct locale
        identifier match could not be made. Otherwise defaults to english date picker region.
        Example: User's locale could be fr-CA which is not supported by the date picker so we need to
                 try with "fr" instead.
    */
	var determineDatePickerRegion = function(localeIdentifier) {
	    var countryIdentifier,
	        languageMatch,
	        determinedRegion = ""; // Empty string gives English calendar translation

        if ( isDefined(localeIdentifier) && localeIdentifier !== "en") {

            if ($.datepicker.regional[localeIdentifier] === undefined) {
                // Checks both "_" and "-" just to be sure. Hyphen is from newer locale spec.
                languageMatch = /(\w+)[_-](\w+)/.exec(localeIdentifier);
                if (languageMatch !== null && languageMatch.length === 3 && $.datepicker.regional[languageMatch[1]] !== undefined) {
                    determinedRegion = languageMatch[1];
                }

            } else {
                determinedRegion = localeIdentifier;
            }
        }

        return determinedRegion;
	};

    this.init = function() {

        $("#createdateOfBirth").datepicker({
            changeMonth: true,
            changeYear: true,
            minDate: '-110Y',
            maxDate: '-1D',
            dateFormat: 'yy-mm-dd',
            yearRange: "-125:+0",
            showMonthAfterYear: true
        });

        $("#editdateOfBirth").datepicker({
            changeMonth: true,
            changeYear: true,
            minDate: '-110Y',
            maxDate: '-1D',
            dateFormat: 'yy-mm-dd',
            yearRange: "-125:+0",
            showMonthAfterYear: true
        });

        var datepickerRegionalString = determineDatePickerRegion(sessvars.currentUser.locale);
        $("#createdateOfBirth").datepicker("option", $.datepicker.regional[datepickerRegionalString]);
        $("#createdateOfBirth").datepicker("option", "appendText", $("#createdateOfBirth").datepicker("option", "dateFormat"));
        $("#editdateOfBirth").datepicker("option", $.datepicker.regional[datepickerRegionalString]);
        $("#editdateOfBirth").datepicker("option", "appendText", $("#editdateOfBirth").datepicker("option", "dateFormat"));

        /*
         * Functionality below for autocomplete customer-search.
         * uses a simple input text field and jQuery datatable
         */
        $("#customerInput")
            .bind("keydown", function(event) {
                // only process these events if we're in "search" mode
                if (document.getElementById('customerSearchDiv').style.display != "block") {
                    return;
                }
                var row = parseInt($(this).data('selectedRow'));
                var rowCount = parseInt($(this).data('rowCount'));
                // prevent using TAB key if we're in "search mode"
                if (event.keyCode === $.ui.keyCode.TAB) {
                    event.preventDefault();
                    // step up or down in the list
                } else if (event.keyCode === $.ui.keyCode.DOWN) {
                    row++;
                    if (row >= rowCount) {
                        row = rowCount - 1;
                    }
                    $(this).data('selectedRow', row);
                    customer.setSelectedRow(row, true);
                } else if (event.keyCode === $.ui.keyCode.UP) {
                    row--;
                    if (row <= 0) {
                        row = 0;
                    }
                    $(this).data('selectedRow', row);
                    customer.setSelectedRow(row, true);
                    // select the highlighted item
                } else if (event.keyCode === $.ui.keyCode.ENTER) {
                    customer.setSelectedCustomer(row);
                    util.hideModal('customerSearchDiv');
                }

            });

        $("#customerInput")
            .bind("keyup", function(event) {
                var val = $(this).val();
                if (val) {
                    val = $.trim(val);
                }
                // these events are handled in "keydown" event handler
                if (event.keyCode === $.ui.keyCode.ENTER ||
                    event.keyCode === $.ui.keyCode.UP ||
                    event.keyCode === $.ui.keyCode.DOWN) {

                    // cancel search
                } else if (event.keyCode === $.ui.keyCode.ESCAPE) {
                    util.hideModal('customerSearchDiv');
                    event.preventDefault();
                    return;
                } else {
                    // stop any timers running
                    var timer = $(this).data('timer');
                    if(timer) {
                        clearTimeout(timer);
                    }
                    
                    // NEW R5: Make sure links are disabled when search changes
                    $("#editCustomerLink").removeClass("customLink").addClass("editCust customLinkDisabled");
                    $("#editCustomerLink").prop('disabled', true);
                    $("#linkCustomerLink").removeClass("customLink").addClass("linkCust customLinkDisabled");
                    $("#linkCustomerLink").prop('disabled', true);
                    $("#deleteCustomerLink").removeClass("customLink").addClass("deleteCust customLinkDisabled");
                    $("#deleteCustomerLink").prop('disabled', true);
                    sessvars.currentCustomer = null;
                    
                    if (val.length >= 2) { //We want at least 2 characters entered.
                        $(this).data('enteredVal', val); //Store the previous value on the autocomplete object.
                        $(this).data('selectedRow', 0); // reset which row has been selected
                        // start a timer to prevent searching "too fast"
                        $(this).data('timer', setTimeout(function() {
                            customer.filterList(val);                            
                            var rowCount = $('#customerSearchTable').dataTable().fnGetData().length;
                            $("#customerInput").data('rowCount', rowCount);
                            if(customer.customerDbOnline) {
                            	util.showModal('customerSearchDiv');
                                customer.positionCustomerResult();
                                if (rowCount != 0) {
                                    customer.setSelectedRow(0, true);
                                }
    						}
                            
                        },
                        300));
                        // less than 2 chars -> clear the table and hide it
                    } else {
                        $('#customerSearchTable').dataTable().fnClearTable();
                        util.hideModal('customerSearchDiv');
                    }
                }
            });

        // column header definitions for the data table
        // read them from i18n to get the visible names
        this.COLUMN_NAMES = [
            "firstName", "lastName", "addressLine1", "addressLine2",
            "addressLine3", "addressLine4", "addressLine5", "addressPostCode",
            "accountNumber", "cardNumber", "phoneNumber", // "phoneMobile", "phoneHome", "phoneWork",
            "email", "dateOfBirth", "gender"];
        var columnDefs = [];
        for (var i=0; i < customer.COLUMN_NAMES.length; i++) {
            var i18name = "field." + customer.COLUMN_NAMES[i];
            columnDefs.push({
                mDataProp: customer.COLUMN_NAMES[i],
                sTitle: '<span style="customerSearchHeader">' + jQuery.i18n.prop(i18name) + '</span>'
            });
        }

        // initialise datatable for the auto-complete customer search
        $("#customerSearchTable").dataTable({
            aaData : [],
            bLengthChange : false,
            bPaginate : false,
            bInfo : false,
            bFilter : false,
            bSort: false,
            asStripClasses: [],
            oLanguage: {
                sEmptyTable: jQuery.i18n.prop('customer.not.found')
            },
            aoColumns : columnDefs
        });

        util.hideModal('customerSearchDiv');

    };

    // the actual search function
    this.filterList = function(val) {
    	// QP-1285, IE caches things way too aggressively
    	var urlextra = "";
    	if (typeof lowfiie !== 'undefined' && lowfiie) {
    		urlextra = '&breakcache=' + Math.random();
    	}
        var prev = $(this).data('enteredVal');
        $('#customerSearchTable').dataTable().fnClearTable();
        if(val !== prev) {
            $.ajax({
                url: "/rest/servicepoint/customers/search?text=" + val + urlextra,
                dataType: 'json',
                async: false,
                success: function(data){
                	customer.customerDbOnline = true;
                    $.map(data, function(item){
                        var transformedCustomer = transformCustomer(item, customer.COLUMN_NAMES);
                        $('#customerSearchTable').dataTable().fnAddData(transformedCustomer);
                    });
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    if(jqXHR.status == 503) {
                      customer.customerDbOnline = false;
                      util.showError(jQuery.i18n.prop('error.central.server.unavailable'));
                      util.hideModal("customerSearchDiv");
                    }
  			  }
            });
            // add click listener to select a customer
            $('#customerSearchTable tbody tr').click( function () {
                var index = $('#customerSearchTable').dataTable().fnGetPosition( this );
                customer.setSelectedCustomer(index);
                $('#customerSearchTable tbody tr').unbind();
                // hide table
                util.hideModal("customerSearchDiv");
            });
            // add mouseover listener, to have the "selected" row follow the mouse pointer
            $('#customerSearchTable tbody tr').mouseover( function () {
                var index = $('#customerSearchTable').dataTable().fnGetPosition( this );
                customer.setSelectedRow(index);
                $("#customerInput").data('selectedRow', index);
            });
            // bind loosing focus on the input field
            $("html").click( function(event) {
                // if we're in search mode, hide the window
                if (document.getElementById('customerSearchDiv').style.display == "block") {
                    util.hideModal("customerSearchDiv");
                }
            });
        }
    };

    /**
     * As of R5, we have a customer object with fixed fields for firstName, lastName, id and cardNumber. All other
     * fields goes into a properties map. This method transforms the "new" Customer object into a plain JS object with
     * all the fields in the properties map set directly as "normal" properties onto the JS object.
     *
     * @param item
     * @returns {___anonymous20437_20559}
     */
    var transformCustomer = function(item, columnNames) {
        // Add the declared fields
        var cust = {
            "firstName":item.firstName,
            "lastName":item.lastName,
            "cardNumber":item.cardNumber,
            "id":item.id
        };

        // Add the other properties
        var props = item.properties;
        for (var key in props) {
            if(props.hasOwnProperty(key)) {
                if(key == "dateOfBirth") {
                    cust[key] = $.datepicker.formatDate($("#editdateOfBirth").datepicker("option", "dateFormat"),
                        $.datepicker.parseDate('yy-mm-dd', props[key]))
                } else {
                    cust[key] = props[key];
                }
            }
        }

        // Finally, make sure all columns from columnNames are added to the customer object, otherwise, then table component will throw an error
        for(var a = 0; a < columnNames.length; a++) {
            if(typeof cust[columnNames[a]] === 'undefined' || cust[columnNames[a]] == null) {
                cust[columnNames[a]] = '';
            }
        }
        return cust;
    };

    // sets selected CSS style on one row
    this.setSelectedRow = function(index, scroll) {
        // clear all styles
        var doScroll = scroll ? true : false;
        $("#customerSearchTable tr").removeClass("row_selected");

        var rows = $("#customerSearchTable").dataTable().fnGetNodes();
        $(rows[index]).addClass('row_selected');

        // scroll to selected index if its outside the visible area
        // only do this if its called by the key listener, scrolling when mouseover is called makes it jump around
        if (doScroll) {
            if (index == 0) {
                document.getElementById("customerSearchDiv").scrollTop = 0;
            } else {
                var currentScroll = document.getElementById("customerSearchDiv").scrollTop;
                var totalHeight = document.getElementById("customerSearchDiv").scrollHeight;
                var currentHeight = parseInt($("#customerSearchDiv").css("height").replace("px", ""));
                if (totalHeight > currentHeight) {
                    var pxPerItem = (totalHeight) / (rows.length);
                    if ((pxPerItem * (index + 1 )) > (currentHeight / 2) ||
                        (pxPerItem * (index + 1)) < currentScroll) {
                        document.getElementById("customerSearchDiv").scrollTop = (pxPerItem * index) - (currentHeight/2);
                    }
                }
            }
        }
    };

    // sets the internal (sessvars) value for the selected customer, and prints the text in the input field
    this.setSelectedCustomer = function(index) {
        var searchCustomer = $('#customerSearchTable').dataTable().fnGetData(index);
        if (searchCustomer) {
            sessvars.currentCustomer = searchCustomer;
            $("#customerInput").value = searchCustomer.firstName + " " + searchCustomer.lastName;
            customer.updateCustomerModule();
        }
    };

    this.createCustomerPressed = function() {
        util.showModal("createCustomerWindow");
        if(servicePoint.hasValidSettings() && sessvars.state.userState == servicePoint.userState.SERVING) {
            $("#saveAndLinkCustomerLink").removeClass("customLinkDisabled").addClass("customLink");
        } else {
            $("#saveAndLinkCustomerLink").removeClass("customLink").addClass("customLinkDisabled");
        }
    };

    this.saveCustomer = function() {
        var parameterizedCustomer = parameterizeCustomer("createCustomerForm");
        if(validateCustomerForm(parameterizedCustomer.$entity)) {
            //special treatment for dateOfBirth
            var parsed = $.datepicker.parseDate('yy-mm-dd',
                $.datepicker.formatDate('yy-mm-dd',
                    $.datepicker.parseDate($("#createdateOfBirth").datepicker("option", "dateFormat"),
                        parameterizedCustomer.$entity.properties.dateOfBirth)
                )
            );
            // convert to UTC format
            if (typeof parsed !== "undefined" && parsed != null) {
                var dateOfBirth = new Date();
                dateOfBirth.setUTCDate(parsed.getDate());
                dateOfBirth.setUTCFullYear(parsed.getFullYear());
                dateOfBirth.setUTCMonth(parsed.getMonth());
                dateOfBirth.setUTCHours(0, 0, 0, 0);
                parameterizedCustomer.$entity.properties.dateOfBirth = dateOfBirth;
            }
            sessvars.currentCustomer = createCustomer(parameterizedCustomer);
            //update edit, link and delete button and close dialogue in case the customer was created
            if(typeof sessvars.currentCustomer !== "undefined") {
                customer.updateCustomerModule();
                //clean form before closing
                cleanCustomerForm("create");
                util.hideModal("createCustomerWindow");
            }
        }
    };

    this.saveAndLinkCustomer = function() {
        if(servicePoint.hasValidSettings() && sessvars.state.userState == servicePoint.userState.SERVING) {
            var parameterizedCustomer = parameterizeCustomer("createCustomerForm");
            if(validateCustomerForm(parameterizedCustomer.$entity)) {
                var parsed = $.datepicker.parseDate('yy-mm-dd', $.datepicker.formatDate('yy-mm-dd',
                    $.datepicker.parseDate($("#createdateOfBirth").datepicker("option", "dateFormat"),
                        parameterizedCustomer.$entity.properties.dateOfBirth)));
                // convert to UTC format
                if (typeof parsed !== "undefined" && parsed != null) {
                    var dateOfBirth = new Date();
                    dateOfBirth.setUTCDate(parsed.getDate());
                    dateOfBirth.setUTCFullYear(parsed.getFullYear());
                    dateOfBirth.setUTCMonth(parsed.getMonth());
                    dateOfBirth.setUTCHours(0, 0, 0, 0);
                    parameterizedCustomer.$entity.properties.dateOfBirth = dateOfBirth;
                }
                var createdCustomer = createCustomer(parameterizedCustomer);
                if(typeof createdCustomer !== "undefined") {
                    //validation ok, all fields nice and proper
                    linkCustomer(createdCustomer.id);
                    $("#linkedCustomerField").html(createdCustomer.firstName + " " + createdCustomer.lastName);
                    cleanCustomerForm("create");
                    util.hideModal("createCustomerWindow");
                }
            }
        }
    };

    var cleanCustomerForm = function(operation) {
        $("#" + operation + "CustomerForm input").val("");
        $("#" + operation + "CustomerForm #creategender").val("-1");
    };

    this.cancelSaveCustomer = function() {
        cleanCustomerForm("create");
        util.hideModal('createCustomerWindow');
    };

    this.editCustomerPressed = function() {
        if(typeof sessvars.currentCustomer !== "undefined" && sessvars.currentCustomer != null) {
            util.showModal("editCustomerWindow");
            // clear modal form to not have old values in there
            $("#editCustomerWindow #editCustomerForm input").val("");
            //customer might have been updated elsewhere, fetch from database before display
            var params = {customerId : parseInt(sessvars.currentCustomer.id)};
            sessvars.currentCustomer = spService.get("customers/"+sessvars.currentCustomer.id);
            for(var customerField in sessvars.currentCustomer) {
                if(sessvars.currentCustomer.hasOwnProperty(customerField)) {
                    if(customerField == 'properties') {
                        // Iterate over all properties
                        var value;
                        for(var property in sessvars.currentCustomer['properties']) {
                            if(sessvars.currentCustomer['properties'].hasOwnProperty(property)) {
                                value = sessvars.currentCustomer['properties'][property];
                                if(property == "gender") {
                                    var editGenderSelect = $("#edit" + property);
                                    util.setSelect(editGenderSelect, value);
                                } else if(property == "dateOfBirth") {
                                    if(typeof value !== "undefined" && value != null && value.length > 0) {
                                        var splitDateTime = value.split("T");
                                        //if birth date has not been modified by the client
                                        var date;
                                        if(splitDateTime.length > 1) {
                                            //yyyy-mm-dd
                                            date = splitDateTime[0].split("-");
                                            //hh:mmm:ss
                                            //poor IE. We need to create date using format: yyyy, mm-1, dd, hh, mm, ss
                                            $("#edit" + property).val($.datepicker.formatDate(
                                                $("#editdateOfBirth").datepicker("option", "dateFormat"),
                                                new Date(date[0], date[1]-1, date[2])));
                                        } else {
                                            date = splitDateTime[0].split("-");
                                            $("#edit" + property).value = $.datepicker.formatDate(
                                                $("#editdateOfBirth").datepicker("option", "dateFormat"),
                                                new Date(date[0], date[1]-1, date[2]));
                                        }
                                    }
                                } else if(property != "status" && property != "id" && property != "dateOfBirth" && property != "gender") {
                                    if (typeof value !== 'undefined' && value != null && value != 'null') {
                                        $("#edit" + property).val(value);
                                    }
                                }
                            }
                        }
                    } else {
                        value = sessvars.currentCustomer[customerField];
                        if(customerField != "id") {
                            try {
                                $("#edit" + customerField).val(value);
                            } finally {}
                        }
                    }
                }
            }
        }
    };

    this.editCustomer = function() {
        var customerParameterized = parameterizeCustomer("editCustomerForm");
        if(validateCustomerForm(customerParameterized.$entity)) {
            //special treatment for dateOfBirth
            var parsed = $.datepicker.parseDate('yy-mm-dd', $.datepicker.formatDate('yy-mm-dd',
                $.datepicker.parseDate(
                    $("#createdateOfBirth").datepicker("option", "dateFormat"),
                    customerParameterized.$entity.properties.dateOfBirth)));
            // convert to UTC format
            if (typeof parsed !== "undefined" && parsed != null ) {
                var dateOfBirth = new Date();
                dateOfBirth.setUTCDate(parsed.getDate());
                dateOfBirth.setUTCFullYear(parsed.getFullYear());
                dateOfBirth.setUTCMonth(parsed.getMonth());
                dateOfBirth.setUTCHours(0, 0, 0, 0);
                customerParameterized.$entity.properties.dateOfBirth = dateOfBirth;
				
            }
			
            customerParameterized.customerId = sessvars.currentCustomer.id;
			cleanCustomerForm("edit");
            util.hideModal("editCustomerWindow");
			var params = servicePoint.createParams();
			params.json =jsonString(customerParameterized);
			spService.putParams("customers/"+customerParameterized.customerId, params);

            //update current customer i.e. the selected customer, NOT the linked customer
            sessvars.currentCustomer = customerParameterized.$entity;
            sessvars.currentCustomer.id = customerParameterized.customerId;

            //update linked customer field if the customer is linked to the current transaction
            if(servicePoint.hasValidSettings(false) && sessvars.state.userState == servicePoint.userState.SERVING &&
                typeof sessvars.state.visit !== "undefined" && sessvars.state.visit != null &&
                sessvars.state.visit.customerIds != null && sessvars.state.visit.customerIds.length > 0 &&
                sessvars.state.visit.customerIds[0] == customerParameterized.customerId) {
                        $("#linkedCustomerField").html(customerParameterized.$entity.firstName + " " + customerParameterized.$entity.lastName);
            }
            //clean form
            cleanCustomerForm("edit");
            util.hideModal("editCustomerWindow");
        }
    };

    this.cancelEditCustomer = function() {
        cleanCustomerForm("edit");
        util.hideModal('editCustomerWindow');
    };

    this.deleteCustomerPressed = function() {
        if(servicePoint.hasValidSettings(false)) {
            if(sessvars.state.userState == servicePoint.userState.SERVING && typeof sessvars.state.visit !== "undefined" &&
                sessvars.state.visit != null && sessvars.state.visit.customerIds != null &&
                sessvars.state.visit.customerIds.length > 0 &&
                sessvars.state.visit.customerIds[0] == sessvars.currentCustomer.id) {
                    util.showError(jQuery.i18n.prop('error.cannot.delete.linked.customer'));
                    return;
            }
        }
        if(typeof sessvars.currentCustomer !== "undefined" && sessvars.currentCustomer != null) {
            util.showModal("deleteCustomerConfirmWindow");
        }
    };

    this.deleteCustomer = function() {
        if(typeof sessvars.currentCustomer !== "undefined" && sessvars.currentCustomer != null) {
            var params = {};
            params.customerId = sessvars.currentCustomer.id;
            spService.del("customers/" + params.customerId);
            sessvars.currentCustomer = null;
            customer.updateCustomerModule();
            util.hideModal("deleteCustomerConfirmWindow");
        }
    };

    //util functions

    var parameterizeCustomer = function(formName) {
        var customerArray = $("#" + formName).serializeArray();
        var customerParameterized = {};
        var properties = {};
        customerParameterized.properties = properties;
        for(var i = 0; i < customerArray.length; i++) {
            if(customerArray[i].name == "firstName" || customerArray[i].name == "lastName" ||
                customerArray[i].name == "id" || customerArray[i].name == "cardNumber") {
                customerParameterized[customerArray[i].name] = customerArray[i].value;
            } else {
                // First, a little special "hack" for the gender select.
                if(customerArray[i].name == "gender" && customerArray[i].value == -1) {
                    customerParameterized.properties[customerArray[i].name] = "";
                    continue;
                }
                customerParameterized.properties[customerArray[i].name] = customerArray[i].value;
            }
		}
        return {"$entity" : customerParameterized};
    };

    var createCustomer = function(parameterizedCustomer) {
		var params = servicePoint.createParams();
		params.json =jsonString(parameterizedCustomer);
		return spService.postParams("customers", params);
    };

	
	var jsonString = function (val) {
		var main = val.$entity;
		var prop = val.$entity.properties;
		var j = '{';
		j += '"firstName":"' + main.firstName + '","lastName":"' + main.lastName + '","cardNumber":"' + main.cardNumber + '"'
		j +=',"properties":{"addressLine1":"' + prop.addressLine1 + '","addressLine2":"' + prop.addressLine2 + '","addressLine3":"' + prop.addressLine3 + '","addressLine4":"' + prop.addressLine4 + '","addressLine5":"' + prop.addressLine5 + '"'
        j +=',"addressPostCode":"' + prop.addressPostCode + '","phoneNumber":"' + prop.phoneNumber + '"'
        //j +=',"phoneMobile":"' + prop.phoneMobile + '","phoneHome":"' + prop.phoneHome + '","phoneWork":"' + prop.phoneWork + '"'
        j +=',"email":"' + prop.email + '","gender":"' + prop.gender + '","dateOfBirth":' + JSON.stringify(prop.dateOfBirth) + ',"accountNumber":"' + prop.accountNumber + '"}}';
		return j;
	}
	
    //link customer stuff below

    var linkCustomer = function(customerId) {
        var params = servicePoint.createParams();
        params.customerId = customerId;
        params.visitId = sessvars.state.visit.id;
        sessvars.state = servicePoint.getState(spService.putCallback("branches/" + params.branchId + "/visits/" + params.visitId + "/customers/" + params.customerId));
        sessvars.statusUpdated = new Date();
        servicePoint.updateWorkstationStatus(false);
    };

    this.linkCustomerPressed = function() {
        if(servicePoint.hasValidSettings() && sessvars.state.userState == servicePoint.userState.SERVING) {
            if(typeof sessvars.currentCustomer !== "undefined" && sessvars.currentCustomer != null &&
                typeof sessvars.currentCustomer.id !== "undefined" && sessvars.currentCustomer.id != null &&
                typeof sessvars.currentCustomer.id === 'number') {
                linkCustomer(sessvars.currentCustomer.id);
                $("#linkedCustomerField").html(sessvars.currentCustomer.firstName + " " +
                    sessvars.currentCustomer.lastName);
                sessvars.currentCustomer = null;
                customer.updateCustomerModule();
            }
        }
    };

    this.updateCustomerModule = function() {
        $("#createCustomerLink").addClass("newCust customLink");
        $("#createCustomerLink").prop('disabled', false);
        if(typeof sessvars.currentCustomer !== "undefined" && sessvars.currentCustomer != null) {
            $("#customerInput").val(sessvars.currentCustomer.firstName + " " +
                sessvars.currentCustomer.lastName);
            $("#editCustomerLink").removeClass("customLinkDisabled").addClass("editCust customLink");
            $("#editCustomerLink").prop('disabled', false);
            if(servicePoint.hasValidSettings() && sessvars.state.userState == servicePoint.userState.SERVING) {
                $("#linkCustomerLink").removeClass("customLinkDisabled").addClass("linkCust customLink");
                $("#linkCustomerLink").prop('disabled', false);
            }
            $("#deleteCustomerLink").removeClass("customLinkDisabled").addClass("deleteCust customLink");
            $("#deleteCustomerLink").prop('disabled', false);
            return;
        }
        $("#customerInput").val("");
        $("#editCustomerLink").removeClass("customLink").addClass("editCust customLinkDisabled");
        $("#editCustomerLink").prop('disabled', true);
        $("#linkCustomerLink").removeClass("customLink").addClass("linkCust customLinkDisabled");
        $("#linkCustomerLink").prop('disabled', true);
        $("#deleteCustomerLink").removeClass("customLink").addClass("deleteCust customLinkDisabled");
        $("#deleteCustomerLink").prop('disabled', true);
    };

    this.updateCustomer = function() {
        if(sessvars.state.userState == servicePoint.userState.SERVING && typeof sessvars.state.visit !== "undefined" &&
            sessvars.state.visit != null) {
            if(sessvars.state.visit.parameterMap != null &&
                typeof sessvars.state.visit.parameterMap.customerName != 'undefined' &&
                sessvars.state.visit.parameterMap.customerName != null &&
                sessvars.state.visit.parameterMap.customerName != "") {
                $("#linkedCustomerField").html(sessvars.state.visit.parameterMap.customerName);
            } else if(typeof sessvars.state.visit.customerIds !== "undefined" &&
                sessvars.state.visit.customerIds != null && sessvars.state.visit.customerIds.length > 0) {
                var customer =spService.get("customers/"+sessvars.state.visit.customerIds[0]);
                $("#linkedCustomerField").html(customer.firstName + " " + customer.lastName);
            }
        }
    };

    var validateCustomerForm = function(customer) {
        var validationError = "";
        var error = false;
        if(customer.firstName == null || customer.firstName == "") {
            error = true;
            validationError = jQuery.i18n.prop('error.first.name.mandatory');
        }
        if(customer.lastName == null || customer.lastName == "") {
            error = true;
            if(validationError == "") {
                validationError = jQuery.i18n.prop('error.last.name.mandatory');
            } else {
                validationError += ", " + jQuery.i18n.prop('error.last.name.mandatory');
            }
        }
        if(!isEmailValid(customer.properties.email)) {
            error = true;
            if(validationError == "") {
                validationError = jQuery.i18n.prop('error.validate.email');
            }
            else {
                validationError += ", " + jQuery.i18n.prop('error.validate.email');
            }
        }
        try {
            //parse date against the localized format
            var dateOfBirth = $.datepicker.parseDate($("#createdateOfBirth").datepicker("option", "dateFormat"), customer.properties.dateOfBirth);
            //in case the user entered a date of birth manually, check that the date is not in the future
            if(typeof dateOfBirth !== "undefined" && dateOfBirth != null && dateOfBirth.length > 0) {
                var now = new Date();
                if(dateOfBirth.getTime() > now.getTime()) {
                    error = true;
                    if(validationError == "") {
                        validationError = jQuery.i18n.prop('error.validate.dateOfBirth');
                    }
                    else {
                        validationError += ", " + jQuery.i18n.prop('error.validate.dateOfBirth');
                    }
                }
            }
        } catch(e) {
            error = true;
            if(validationError == "") {
                validationError = jQuery.i18n.prop('error.validate.dateOfBirth'); //+ ": " + e; can't i18n the exceptions without modifying jquery.ui
            } else {
                validationError += ", " + jQuery.i18n.prop('error.validate.dateOfBirth'); //+ ": " + e;  can't i18n the exceptions without modifying jquery.ui
            }
        }

        if(error) {
            util.showError(validationError);
            return false;
        }
        return true;
    };

    // position the search box (this is also used when updating the queues)
    this.positionCustomerResult = function() {
        $("#customerSearchDiv").position({
            my: "right top",
            at: "right bottom",
            of: $("#customerInput")
        });
    };

    var isEmailValid = function(emailString) {
        // Don't validate empty Strings - those are OK
        if (emailString == null || emailString == "") {
            return true;
        }

        var p = new RegExp(".+@.+\\.[a-z]+");
        return p.test(emailString);
    };
};
