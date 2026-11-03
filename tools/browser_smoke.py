#!/usr/bin/env python3
"""Verificação visual básica em Chromium: desktop, tablet e celular."""
from playwright.sync_api import sync_playwright
from urllib.parse import urljoin

BASE = "http://127.0.0.1:8123/"
PAGES = ["index.html","louvores.html","agenda.html","canal.html",
         "mural.html","contribuir.html","historia.html",
         "estudos-biblicos.html","enviar-cifra.html","administracao.html"]

def main():
    errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, args=["--no-sandbox"])
        for width, height in [(390,844),(768,1024),(1440,900)]:
            context=browser.new_context(viewport={"width":width,"height":height}, locale="pt-BR")
            for path in PAGES:
                page=context.new_page()
                errs=[]
                page.on("pageerror", lambda e: errs.append(str(e)))
                try:
                    page.goto(urljoin(BASE,path),wait_until="domcontentloaded",timeout=20000)
                    page.locator("h1").first.wait_for(state="visible",timeout=10000)
                    page.wait_for_timeout(300)
                    if page.locator("h1").count()!=1:
                        errors.append(f"{width}px {path}: H1 duplicado/ausente")
                    widthActual=page.evaluate("document.documentElement.scrollWidth")
                    if widthActual>width+3:
                        errors.append(f"{width}px {path}: rolagem horizontal ({widthActual}px)")
                    logo=page.locator(".brand-icon .igreja-logo").first
                    if logo.count():
                        if logo.evaluate("img => img.complete && img.naturalWidth > 0") is False:
                            errors.append(f"{width}px {path}: logotipo não carregou")
                    if width<=768:
                        if page.locator(".igjal-mobile-quicknav").is_visible() is False:
                            errors.append(f"{width}px {path}: atalhos móveis não visíveis")
                    if width==390 and path=="index.html":
                        page.locator("#login-button").click()
                        if not page.locator("#member-password-login").is_visible():
                            errors.append("Login: formulário com senha não foi exibido")
                        page.locator('[data-member-mode="cadastro"]').click()
                        if not page.locator("#member-signup").is_visible():
                            errors.append("Cadastro: formulário para novo membro indisponível")
                        page.locator('[data-member-mode="recuperar"]').click()
                        if not page.locator("#member-recovery").is_visible():
                            errors.append("Conta: recuperação de senha não aparece")
                        page.locator('[data-close="login-dialog"]').click()
                    if width==390 and path=="mural.html":
                        if not page.locator("#send-comment").is_disabled():
                            errors.append("Mural: envio deve estar bloqueado a visitantes")
                        if not page.locator("#mural-member-notice").is_visible():
                            errors.append("Mural: não mostra instruções de cadastro")
                    if width==390 and path=="administracao.html":
                        if not page.locator("#admin-locked").is_visible():
                            errors.append("Administração: visitantes não devem ver painel")
                        if not page.locator("#admin-tab-usuarios").is_hidden():
                            errors.append("Administração: aba de acessos está pública")
                    if width==390 and path=="canal.html":
                        page.locator('[data-youtube-filter="orquestra"]').click()
                        page.wait_for_timeout(250)
                        if page.locator(".youtube-video-card").count()==0:
                            errors.append("Canal: filtro Orquestra não exibiu vídeos")
                        page.locator('[data-youtube-filter="quarteto"]').click()
                        if page.locator(".youtube-video-card").count()==0:
                            errors.append("Canal: filtro Quarteto não exibiu vídeos")
                        page.locator('[data-youtube-filter="coral"]').click()
                        if page.locator(".youtube-video-card").count()==0:
                            errors.append("Canal: filtro Coral não exibiu vídeos")
                    if width==390 and path=="louvores.html":
                        if page.locator("#hino-member-form").count()!=1:
                            errors.append("Hinário: formulário de comentários não carregou")
                        page.locator("#song-search").fill("Jesus")
                        if page.locator(".song-card").count()==0:
                            errors.append("Hinário: busca por texto não produziu resultados")

                        # Cifras longas devem caber na largura do visor, mesmo com
                        # espaçamento original excessivo na partitura PDF.
                        page.locator("#song-search").fill("1")
                        page.locator(".song-card").first.click()
                        page.locator('[data-dialog-mode="cifra"]').click()
                        content=page.locator("#song-dialog-content")
                        if not content.evaluate("el => el.classList.contains('mobile-cifra')"):
                            errors.append("Hinário: cifra móvel não ativada")
                        widths=content.evaluate("""el => {
                            const b=el.getBoundingClientRect();
                            return {viewport:window.innerWidth, left:b.left, right:b.right,
                                scroll:el.scrollWidth, client:el.clientWidth};
                        }""")
                        if widths["right"]>width+2 or widths["left"]< -2 or widths["scroll"]>widths["client"]+2:
                            errors.append(f"Hino 1: cifra ultrapassa tela: {widths}")
                        if content.locator(".mobile-cifra-word").count()==0:
                            errors.append("Hino 1: acordes não foram distribuídos nas palavras")
                        toggle=page.locator("#mobile-chord-panel-toggle")
                        if not toggle.is_visible() or toggle.get_attribute("aria-expanded")!="false":
                            errors.append("Hino 1: painel verde deve iniciar recolhido")
                        if not content.is_visible():
                            errors.append("Hino 1: cifra não visível no celular")
                        toggle.click()
                        if toggle.get_attribute("aria-expanded")!="true":
                            errors.append("Hino 1: não abriu ajustes de voz e tom")
                        toggle.click()
                        if toggle.get_attribute("aria-expanded")!="false":
                            errors.append("Hino 1: não recolheu ajustes de voz e tom")
                        toggle.click()
                        page.locator("#transpose-key").select_option("A")
                        after=content.inner_text()
                        if not ("A" in after and content.locator(".mobile-cifra-verse").count()>0):
                            errors.append("Hino 1: transposição responsiva falhou")
                        page.locator('[data-close="song-dialog"]').click()
                        page.locator("#song-search").fill("73")
                        page.locator(".song-card").first.click()
                        if not page.locator("#hino-member-prompt").is_visible():
                            errors.append("Hinário: convite de cadastro no hino aberto não aparece")
                        page.locator('[data-dialog-mode="cifra"]').click()
                        page.locator("#mobile-chord-panel-toggle").click()
                        original=page.locator("#transpose-original").inner_text()
                        if "Dó" not in original:
                            errors.append(f"Hino 73: tom original incorreto: {original}")
                        original_chords=page.locator("#song-dialog-content .mobile-cifra-chord").all_text_contents()
                        page.locator("#transpose-key").select_option("D")
                        transposed_chords=page.locator("#song-dialog-content .mobile-cifra-chord").all_text_contents()
                        if original_chords==transposed_chords or "D" not in transposed_chords:
                            errors.append("Hino 73: transposição C → D não funcionou")
                        page.evaluate("window.print = () => {window.__igjal_print_called = true;}")
                        page.locator("#print-song").click()
                        if not page.evaluate("window.__igjal_print_called"):
                            errors.append("Hino 73: botão Imprimir não acionou impressão")
                        if "Enche-Me, Oh Deus" not in page.locator("#print-song-title").inner_text():
                            errors.append("Hino 73: título ausente na impressão")
                        if "Tom selecionado: D" not in page.locator("#print-song-tone").inner_text():
                            errors.append("Hino 73: tom transposto ausente na impressão")
                        page.emulate_media(media="print")
                        if not page.locator("#print-song-sheet").is_visible():
                            errors.append("Hino 73: folha de impressão está oculta")
                        print_logo=page.locator(".igjal-print-heading img")
                        if not print_logo.evaluate("img => img.complete && img.naturalWidth > 0"):
                            errors.append("Hino 73: logotipo não aparece na impressão")
                        page.emulate_media(media="screen")
                        if page.locator("#print-song-sheet").is_visible():
                            errors.append("Hino 73: layout de impressão interfere na tela")
                    if errs:
                        errors.append(f"{width}px {path}: erros JS: {errs[:2]}")
                except Exception as exc:
                    errors.append(f"{width}px {path}: falha de teste: {exc}")
                finally:
                    page.close()
            context.close()
        browser.close()
    if errors:
        print("\n".join("ERRO: "+e for e in errors))
        raise SystemExit(1)
    print("OK: 30 verificações de página em celular, tablet e computador.")

if __name__=="__main__":
    main()
