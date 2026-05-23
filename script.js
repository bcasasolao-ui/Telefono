document.addEventListener('DOMContentLoaded', () => {
    // Base URL from Scalar / OpenAPI (punycode host)
    const API_BASE = 'https://xn--sistemapagostelefona-74b.azurewebsites.net/api/Telefonia';

    const ENDPOINTS = {
        clientes: `${API_BASE}/clientes`,
        facturar: `${API_BASE}/facturar`,
        cobrar: `${API_BASE}/cobrar`,
        pagar: `${API_BASE}/pagar`,
        consultar: (numero) => `${API_BASE}/consultar/${encodeURIComponent(numero)}`,
        historial: (numero) => `${API_BASE}/historial/${encodeURIComponent(numero)}`,
        conciliacion: `${API_BASE}/conciliacion`,
    };

    const btnUsuario = document.getElementById('btn-vista-usuario');
    const btnAdmin = document.getElementById('btn-vista-admin');
    const vistaUsuario = document.getElementById('vista-usuario');
    const vistaAdmin = document.getElementById('vista-admin');

    const form = document.getElementById('payment-form');
    const phoneInput = document.getElementById('phone');
    const amountBtns = document.querySelectorAll('.amount-btn');
    const customAmountInput = document.getElementById('custom-amount');
    const operatorBtns = document.querySelectorAll('.operator-btn');
    const loader = document.getElementById('loader');
    const successScreen = document.getElementById('success');
    const debtInfo = document.getElementById('debt-info');

    const tablaBody = document.getElementById('tabla-historial-body');
    const btnRefreshAdmin = document.getElementById('btn-refresh-admin');
    const adminPhoneSearch = document.getElementById('admin-phone-search');
    const conciliacionResumen = document.getElementById('conciliacion-resumen');
    const successReceipt = document.getElementById('success-receipt');
    const btnNuevaOperacion = document.getElementById('btn-nueva-operacion');

    const LAST_PAYMENT_KEY = 'telepay_ultimo_pago';

    let selectedOperator = '';

    function guardarUltimoPago(datos) {
        sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(datos));
    }

    function obtenerUltimoPago() {
        try {
            return JSON.parse(sessionStorage.getItem(LAST_PAYMENT_KEY) || 'null');
        } catch {
            return null;
        }
    }

    function normalizarTransaccion(t, numeroFallback) {
        return {
            telefono:
                t.numero_telefonico ??
                t.numeroTelefonico ??
                t.telefono ??
                numeroFallback,
            operador: t.plan_contratado ?? t.planContratado ?? t.operador ?? '—',
            servicio:
                t.tipo_servicio ??
                t.tipoServicio ??
                t.tipo ??
                t.concepto ??
                t.descripcion ??
                'pago',
            monto: Number(
                t.monto ?? t.monto_pagado ?? t.montoPagado ?? t.monto_factura ?? t.montoFactura ?? 0
            ),
            fecha:
                t.fecha ??
                t.fecha_transaccion ??
                t.fechaTransaccion ??
                t.fecha_pago ??
                t.fechaPago ??
                t.fecha_corte ??
                t.fechaCorte ??
                null,
        };
    }

    function renderFilaHistorial(tx) {
        const fila = document.createElement('tr');
        fila.className = 'hover:bg-slate-800/50 transition-colors';
        fila.innerHTML = `
            <td class="p-4 font-medium text-white">${tx.telefono}</td>
            <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800">${tx.operador}</span></td>
            <td class="p-4 uppercase text-xs text-slate-400">${tx.servicio}</td>
            <td class="p-4 font-bold text-cyanElectric">Q ${tx.monto.toFixed(2)}</td>
            <td class="p-4 text-xs text-slate-500">${tx.fecha ? new Date(tx.fecha).toLocaleString('es-GT') : '—'}</td>
        `;
        return fila;
    }

    function mostrarComprobante(pago, respuestaApi) {
        if (!successReceipt) return;

        const refs = [
            respuestaApi?.id_transaccion,
            respuestaApi?.idTransaccion,
            respuestaApi?.referencia,
            respuestaApi?.mensaje,
        ].filter(Boolean);

        const filas = [
            ['Teléfono', pago.numero],
            ['Operador', pago.operador],
            ['Servicio', pago.servicio],
            ['Monto', `Q ${pago.monto.toFixed(2)}`],
            ['Fecha', new Date(pago.fecha).toLocaleString('es-GT')],
        ];

        if (refs.length) filas.push(['Referencia', refs[0]]);

        successReceipt.innerHTML = filas
            .map(
                ([label, value]) =>
                    `<div class="flex justify-between gap-3"><dt class="text-slate-500">${label}</dt><dd class="font-semibold text-slate-800 text-right">${value}</dd></div>`
            )
            .join('');
    }

    function resetearFormularioPago() {
        form.reset();
        selectedOperator = '';
        operatorBtns.forEach((b) => b.classList.remove('active'));
        amountBtns.forEach((b) => b.classList.remove('active-amount'));
        if (debtInfo) debtInfo.classList.add('hidden');
        successScreen.classList.add('hidden');
        successScreen.classList.remove('flex');
        if (successReceipt) successReceipt.innerHTML = '';
    }

    function cargarAdminDespuesDePago() {
        const ultimo = obtenerUltimoPago();
        if (!ultimo?.numero) return;

        if (adminPhoneSearch && !adminPhoneSearch.value) {
            adminPhoneSearch.value = ultimo.numero;
        }
        cargarHistorial(ultimo.numero);
    }

    async function apiRequest(url, options = {}) {
        const config = {
            headers: { Accept: 'application/json', ...options.headers },
            ...options,
        };

        const response = await fetch(url, config);
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        if (!response.ok) {
            const message =
                (data && (data.mensaje || data.title || data.detail)) ||
                `Error del servidor (${response.status})`;
            const err = new Error(message);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    }

    function setActiveNav(active) {
        const activeClass =
            'bg-cyanElectric text-navy px-3 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-xs md:text-sm transition-all shadow-md shadow-cyanElectric/10 whitespace-nowrap';
        const inactiveClass =
            'bg-slate-800 text-slate-300 px-3 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-xs md:text-sm hover:bg-slate-700 transition-all whitespace-nowrap';

        if (active === 'usuario') {
            btnUsuario.className = activeClass;
            btnAdmin.className = inactiveClass;
            vistaUsuario.classList.remove('hidden');
            vistaAdmin.classList.add('hidden');
        } else {
            btnAdmin.className = activeClass;
            btnUsuario.className = inactiveClass;
            vistaAdmin.classList.remove('hidden');
            vistaUsuario.classList.add('hidden');
        }
    }

    btnUsuario.addEventListener('click', () => setActiveNav('usuario'));

    btnAdmin.addEventListener('click', () => {
        setActiveNav('admin');
        cargarConciliacion();
        cargarAdminDespuesDePago();
    });

    btnNuevaOperacion?.addEventListener('click', resetearFormularioPago);

    btnRefreshAdmin.addEventListener('click', () => {
        cargarConciliacion();
        const numero = adminPhoneSearch?.value?.trim();
        if (numero && numero.length >= 8) {
            cargarHistorial(numero);
        }
    });

    adminPhoneSearch?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    adminPhoneSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const numero = adminPhoneSearch.value.trim();
            if (numero.length >= 8) cargarHistorial(numero);
        }
    });

    async function cargarConciliacion() {
        if (!conciliacionResumen) return;

        conciliacionResumen.innerHTML =
            '<p class="text-cyanElectric animate-pulse text-sm">Consultando conciliación...</p>';

        try {
            const data = await apiRequest(ENDPOINTS.conciliacion);
            conciliacionResumen.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Empresa</p>
                        <p class="text-white font-semibold mt-1">${data.empresa ?? '—'}</p>
                    </div>
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cuenta</p>
                        <p class="text-white font-semibold mt-1">${data.cuenta_transitoria ?? '—'}</p>
                    </div>
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Saldo acumulado</p>
                        <p class="text-cyanElectric font-bold text-xl mt-1">Q ${Number(data.saldo_acumulado ?? 0).toFixed(2)}</p>
                    </div>
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fecha de corte</p>
                        <p class="text-slate-300 text-sm mt-1">${data.fecha_corte ?? '—'}</p>
                    </div>
                </div>
            `;
        } catch (err) {
            conciliacionResumen.innerHTML = `<p class="text-red-400 text-sm">⚠️ ${err.message}</p>`;
        }
    }

    async function cargarHistorial(numero) {
        tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-cyanElectric animate-pulse">Cargando historial de ${numero}...</td></tr>`;

        try {
            const transacciones = await apiRequest(ENDPOINTS.historial(numero));
            const lista = Array.isArray(transacciones) ? transacciones : [];

            tablaBody.innerHTML = '';

            if (lista.length === 0) {
                const ultimo = obtenerUltimoPago();
                if (ultimo?.numero === numero) {
                    tablaBody.appendChild(
                        renderFilaHistorial({
                            numero_telefonico: ultimo.numero,
                            plan_contratado: ultimo.operador,
                            tipo_servicio: ultimo.servicio,
                            monto: ultimo.monto,
                            fecha: ultimo.fecha,
                        })
                    );
                    const aviso = document.createElement('tr');
                    aviso.innerHTML = `<td colspan="5" class="px-4 pb-4 text-center text-xs text-amber-400/90">El API devolvió historial vacío; se muestra el último pago de esta sesión. Si el backend guarda movimientos, confirma el formato de <code class="text-slate-400">GET /historial/{numero}</code>.</td>`;
                    tablaBody.appendChild(aviso);
                    return;
                }
                tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">Sin movimientos en el API para ${numero}. Prueba con el mismo número que acabas de pagar.</td></tr>`;
                return;
            }

            lista.forEach((t) => {
                tablaBody.appendChild(renderFilaHistorial(normalizarTransaccion(t, numero)));
            });
        } catch (err) {
            tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-400 font-medium">⚠️ ${err.message}</td></tr>`;
        }
    }

    operatorBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            operatorBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            selectedOperator = btn.dataset.op;
        });
    });

    phoneInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (debtInfo) debtInfo.classList.add('hidden');
    });

    document.querySelectorAll('input[name="service"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (debtInfo) debtInfo.classList.add('hidden');
            if (radio.value === 'postpago' && phoneInput.value.length >= 8) {
                consultarDeuda(phoneInput.value.trim());
            }
        });
    });

    phoneInput.addEventListener('blur', () => {
        const servicio = document.querySelector('input[name="service"]:checked')?.value;
        if (servicio === 'postpago' && phoneInput.value.length >= 8) {
            consultarDeuda(phoneInput.value.trim());
        }
    });

    async function consultarDeuda(numero) {
        if (!debtInfo) return;

        debtInfo.classList.remove('hidden');
        debtInfo.innerHTML = '<p class="text-xs text-slate-500">Consultando saldo pendiente...</p>';

        try {
            const data = await apiRequest(ENDPOINTS.consultar(numero));
            const monto = data.monto_factura ?? data.saldo_pendiente ?? data.monto ?? data.deuda;
            if (monto != null) {
                debtInfo.innerHTML = `<p class="text-sm text-slate-700"><span class="font-bold">Saldo pendiente:</span> <span class="text-cyanElectric-dark font-bold">Q ${Number(monto).toFixed(2)}</span></p>`;
                if (!customAmountInput.value) customAmountInput.value = monto;
            } else {
                debtInfo.innerHTML = `<p class="text-sm text-slate-600">${data.mensaje ?? 'Consulta realizada. Ingresa el monto a pagar.'}</p>`;
            }
        } catch (err) {
            debtInfo.innerHTML = `<p class="text-sm text-amber-700">${err.message}</p>`;
        }
    }

    amountBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            customAmountInput.value = btn.dataset.val;
            amountBtns.forEach((b) => b.classList.remove('active-amount'));
            btn.classList.add('active-amount');
        });
    });

    customAmountInput.addEventListener('input', () => {
        amountBtns.forEach((b) => b.classList.remove('active-amount'));
    });

    async function ejecutarCobro(numero, monto, servicio) {
        const payload = {
            numero_telefonico: numero,
            monto,
            tipo_servicio: servicio,
        };

        try {
            return await apiRequest(ENDPOINTS.cobrar, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            if (err.status !== 404) throw err;

            // Azure aún sin /cobrar (hasta merge del backend): usar /pagar legacy
            return await apiRequest(ENDPOINTS.pagar, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numero_telefonico: numero,
                    monto,
                }),
            });
        }
    }

    async function registrarCliente(numero, operador) {
        const suscriptor = {
            numero_telefonico: numero,
            nombre_titular: `Cliente ${numero}`,
            plan_contratado: operador,
        };

        try {
            await apiRequest(ENDPOINTS.clientes, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(suscriptor),
            });
        } catch {
            await apiRequest(ENDPOINTS.clientes, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(suscriptor),
            });
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedOperator) {
            alert('Por favor, selecciona un operador');
            return;
        }
        if (phoneInput.value.length < 8) {
            alert('El número debe tener 8 dígitos');
            return;
        }
        if (!customAmountInput.value || parseFloat(customAmountInput.value) <= 0) {
            alert('Ingresa un monto válido');
            return;
        }

        const numero = phoneInput.value.trim();
        const monto = parseFloat(customAmountInput.value);

        loader.classList.remove('hidden');

        const servicio =
            document.querySelector('input[name="service"]:checked')?.value ?? 'recarga';

        try {
            await registrarCliente(numero, selectedOperator);

            const respuestaPago = await ejecutarCobro(numero, monto, servicio);

            const ultimoPago = {
                numero,
                operador: selectedOperator,
                servicio,
                monto,
                fecha: new Date().toISOString(),
            };
            guardarUltimoPago(ultimoPago);
            mostrarComprobante(ultimoPago, respuestaPago);

            loader.classList.add('hidden');
            successScreen.classList.remove('hidden');
            successScreen.classList.add('flex');
        } catch (err) {
            loader.classList.add('hidden');
            console.error('Error en la petición:', err);
            alert(err.message || 'Error de conexión con el servidor.');
        }
    });
});
