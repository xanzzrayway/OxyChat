function goBack() {
  window.location.href = '../';
}

const form = document.getElementById('emailForm');
        const btnSubmit = document.getElementById('btnSubmit');
        const limitInfo = document.getElementById('limitInfo');
        const inputs = form.querySelectorAll('.form-control');
        
        // Element Overlays & Screens
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingState = document.getElementById('loadingState');
        const successState = document.getElementById('successState');
        const btnDone = document.getElementById('btnDone');
        
        // Summary Card Elements
        const summaryOverlay = document.getElementById('summaryOverlay');
        const btnCloseSummary = document.getElementById('btnCloseSummary');
        const sumName = document.getElementById('sumName');
        const sumEmail = document.getElementById('sumEmail');
        const sumSubject = document.getElementById('sumSubject');
        const sumMessage = document.getElementById('sumMessage');

        // LOCALSTORAGE VERSI BARU (Biar bisa langsung test ulang)
        const STORAGE_KEY = 'hasSentOxyChatRequest_v3';
        
        // Variabel penampung data kiriman sementara
        let submittedData = { name: '', email: '', subject: '', message: '' };

        // Cek status kirim pas buka web
        document.addEventListener('DOMContentLoaded', () => {
            if (localStorage.getItem(STORAGE_KEY)) {
                lockForm();
            }
        });

        function lockForm() {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Pesan Berhasil Terkirim!";
            limitInfo.style.display = "block";
            inputs.forEach(input => {
                input.disabled = true;
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            if (localStorage.getItem(STORAGE_KEY)) {
                alert("Lu udah pernah ngirim request!");
                lockForm();
                return;
            }

            // Simpan data input sebelum di-reset nanti
            submittedData.name = document.getElementById('senderName').value;
            submittedData.email = document.getElementById('email').value;
            submittedData.subject = document.getElementById('subject').value;
            submittedData.message = document.getElementById('message').value;

            // Aktifin Full Screen Loading Overlay
            loadingState.style.display = "block";
            successState.style.display = "none";
            loadingOverlay.classList.add('active');

            const formData = new FormData(form);
            const object = Object.fromEntries(formData);
            const json = JSON.stringify(object);

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: json
            })
            .then(async (response) => {
                let res = await response.json();
                if (response.status == 200) {
                    // Simpan status sukses di localstorage
                    localStorage.setItem(STORAGE_KEY, 'true');
                    form.reset();

                    // Transisi loading ke animasi centang (success state)
                    setTimeout(() => {
                        loadingState.style.display = "none";
                        successState.style.display = "block";
                    }, 800); 
                } else {
                    loadingOverlay.classList.remove('active');
                    alert("Gagal mengirim: " + res.message);
                }
            })
            .catch(error => {
                loadingOverlay.classList.remove('active');
                alert("Koneksi bermasalah nih...");
            });
        });

        // Tombol Selesai diklik -> Tutup centang & buka Rincian Request
        btnDone.addEventListener('click', () => {
            loadingOverlay.classList.remove('active');

            // Set isi data ke pop-up Rincian Request
            sumName.textContent = submittedData.name;
            sumEmail.textContent = submittedData.email;
            sumSubject.textContent = submittedData.subject;
            sumMessage.textContent = submittedData.message;

            // Munculin pop-up Rincian Request
            setTimeout(() => {
                summaryOverlay.classList.add('active');
            }, 300);
        });

        // Tombol Tutup Rincian Request diklik -> Selesai & Lock Form utama
        btnCloseSummary.addEventListener('click', () => {
            summaryOverlay.classList.remove('active');
            lockForm();
        });
