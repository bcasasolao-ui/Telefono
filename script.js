document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // CONFIGURACIÓN DE LAS RUTAS DE LA API REAL
    // ==========================================
    const API_URL_POST = 'https://xn--sistemapagostelefona-74b.azurewebsites.net/api/Telefonia/facturar'; 
    // Pregúntale a tu amigo cuál es la ruta GET para listar todo, asumamos la base:
    const API_URL_GET = 'https://xn--sistemapagostelefona-74b.azurewebsites.net/api/Telefonia'; 

    // Elementos de cambio de rol
    const btnUsuario = document.getElementById('btn-vista-usuario');
    const btnAdmin = document.getElementById('btn-vista-admin');
    const vistaUsuario = document.getElementById('vista-usuario');
    const vistaAdmin = document.getElementById('vista-admin');
    
    // Elementos del formulario usuario
    const form = document.getElementById('payment-form');
    const phoneInput = document.getElementById('phone');
    const amountBtns = document.querySelectorAll('.amount-btn');
    const customAmountInput = document.getElementById('custom-amount');
    const operatorBtns = document.querySelectorAll('.operator-btn');
    const loader = document.getElementById('loader');
    const successScreen = document.getElementById('success');
    
    // Elementos de la tabla de administración
    const tablaBody = document.getElementById('tabla-historial-body');
    const btnRefreshAdmin = document.getElementById('btn-refresh-admin');

    let selectedOperator = '';

    // ==========================================
    // CONTROL DE VISTAS (INTERCAMBIO DE ROL)
    // ==========================================
    btnUsuario.addEventListener('click', () => {
        // Estilos de botones
        btnUsuario.className = "bg-cyanElectric text-navy px-5 py-2 rounded-full font-bold text-sm transition-all";
        btnAdmin.className = "bg-slate-800 text-slate-300 px-5 py-2 rounded-full font-bold text-sm hover:bg-slate-750 transition-all";
        // Mostrar/Ocultar secciones
        vistaUsuario.classList.remove('hidden');
        vistaAdmin.classList.add('hidden');
    });

    btnAdmin.addEventListener('click', () => {
        // Estilos de botones
        btnAdmin.className = "bg-cyanElectric text-navy px-5 py-2 rounded-full font-bold text-sm transition-all";
        btnUsuario.className = "bg-slate-800 text-slate-300 px-5 py-2 rounded-full font-bold text-sm hover:bg-slate-750 transition-all";
        // Mostrar/Ocultar secciones
        vistaAdmin.classList.remove('hidden');
        vistaUsuario.classList.add('hidden');
        
        // Carga los datos automáticamente al entrar como admin
        cargarHistorialAzure();
    });

    btnRefreshAdmin.addEventListener('click', cargarHistorialAzure);

    // Lógica para descargar datos del C# de tu amigo (GET)
    function cargarHistorialAzure() {
        tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-cyanElectric animate-pulse">Conectando con Azure...</td></tr>`;

        fetch(API_URL_GET)
            .then(res => {
                if(!res.ok) throw new Error("Error al obtener datos");
                return res.json();
            })
            .then(transacciones => {
                tablaBody.innerHTML = ''; // Limpiamos el texto de carga
                
                if(transacciones.length === 0) {
                    tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">No hay pagos registrados en la base de datos.</td></tr>`;
                    return;
                }

                // Inyectamos fila por fila los datos guardados en la base de datos
                transacciones.forEach(t => {
                    const fila = document.createElement('tr');
                    fila.className = "border-b border-slate-800 hover:bg-slate-850 transition-colors";
                    fila.innerHTML = `
                        <td class="p-4 font-medium text-white">${t.telefono || 'N/A'}</td>
                        <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800">${t.operador || 'N/A'}</span></td>
                        <td class="p-4 uppercase text-xs text-slate-400">${t.tipo_servicio || 'recarga'}</td>
                        <td class="p-4 font-bold text-cyanElectric">Q ${(t.monto || 0).toFixed(2)}</td>
                        <td class="p-4 text-xs text-slate-500">${t.fecha_transaccion ? new Date(t.fecha_transaccion).toLocaleString() : 'Reciente'}</td>
                    `;
                    tablaBody.appendChild(fila);
                });
            })
            .catch(err => {
                console.error("Error al cargar historial:", err);
                tablaBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-400 font-medium">⚠️ Error de conexión con Azure (Revisa los CORS o la ruta en F12)</td></tr>`;
            });
    }

    // ==========================================
    // LÓGICA DE USUARIO (EL FORMULARIO QUE YA TENÍAS)
    // ==========================================
    operatorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            operatorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedOperator = btn.dataset.op;
        });
    });

    phoneInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            customAmountInput.value = btn.dataset.val;
            amountBtns.forEach(b => b.classList.remove('active-amount'));
            btn.classList.add('active-amount');
        });
    });

    customAmountInput.addEventListener('input', () => {
        amountBtns.forEach(b => b.classList.remove('active-amount'));
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!selectedOperator) { alert('Por favor, selecciona un operador'); return; }
        if (phoneInput.value.length < 8) { alert('El número debe tener 8 dígitos'); return; }
        if (!customAmountInput.value || parseFloat(customAmountInput.value) <= 0) { alert('Ingresa un monto válido'); return; }

        const servicioSeleccionado = document.querySelector('input[name="service"]:checked').value;

        const datosPago = {
            operador: selectedOperator,
            telefono: phoneInput.value.trim(),
            tipo_servicio: servicioSeleccionado,
            monto: parseFloat(customAmountInput.value),
            fecha_transaccion: new Date().toISOString()
        };

        loader.classList.remove('hidden');

        fetch(API_URL_POST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosPago)
        })
        .then(response => {
            if (!response.ok) throw new Error(`Error: ${response.status}`);
            return response.json();
        })
        .then(data => {
            loader.classList.add('hidden');
            successScreen.classList.remove('hidden');
            successScreen.classList.add('flex');
        })
        .catch(error => {
            loader.classList.add('hidden');
            console.error("Error en la petición:", error);
            alert("Error de conexión con el servidor. Revisa los CORS.");
        });
    });
});