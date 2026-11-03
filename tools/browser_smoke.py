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
                        page.locator("#song-search").fill("Jesus")
                        if page.locator(".song-card").count()==0:
                            errors.append("Hinário: busca por texto não produziu resultados")
                        page.locator("#song-search").fill("73")
                        page.locator(".song-card").first.click()
                        page.locator('[data-dialog-mode="cifra"]').click()
                        original=page.locator("#transpose-original").inner_text()
                        if "Dó" not in original:
                            errors.append(f"Hino 73: tom original incorreto: {original}")
                        original_text=page.locator("#song-dialog-content").inner_text()
                        page.locator("#transpose-key").select_option("D")
                        transposed=page.locator("#song-dialog-content").inner_text()
                        if original_text==transposed or not transposed.strip().startswith("D"):
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
