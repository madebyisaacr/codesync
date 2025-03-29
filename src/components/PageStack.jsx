import {
	useState,
	createContext,
	useContext,
	useEffect,
	useMemo,
	forwardRef,
	useImperativeHandle,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import classNames from "classnames";

export const PageStackContext = createContext({});

const DURATION = 0.2;

const OPACITY_TRANSITION = {
	type: "ease",
	ease: [0.12, 0.23, 0.25, 1],
	duration: DURATION,
};

export const TRANSITION = {
	type: "spring",
	bounce: 0,
	duration: DURATION,
	opacity: OPACITY_TRANSITION,
	backdropFilter: OPACITY_TRANSITION,
	boxShadow: {
		type: "tween",
		ease: "linear",
		duration: DURATION,
	},
};

export function usePageStack() {
	return useContext(PageStackContext);
}

// Page:
// component

export const PageStack = forwardRef(function PageStack({ children }, ref) {
	const { openPage: topLevelOpenPage } = usePageStack();
	const [pageStack, setPageStack] = useState([]);
	const [modalStack, setModalStack] = useState([]);
	const [home, setHome] = useState({ component: children });

	function openPage(page, options = { replace: false, topLevel: false, modal: false }) {
		if (!page) {
			return;
		}

		const { replace, topLevel } = options;
		const modal = options.modal;
		const item = { component: page };

		if (topLevelOpenPage && (topLevel || modal)) {
			topLevelOpenPage(page, options);
		} else if (modal) {
			if (replace) {
				if (modalStack.length > 0) {
					setModalStack([...modalStack.slice(0, modalStack.length - 1), item]);
				} else {
					setModalStack([item]);
				}
			} else {
				setModalStack([...modalStack, item]);
			}
		} else {
			if (replace) {
				if (pageStack.length > 0) {
					setPageStack([...pageStack.slice(0, pageStack.length - 1), item]);
				} else {
					setHome(item);
				}
			} else {
				setPageStack([...pageStack, item]);
			}
		}
	}

	function openModal(modal, options = {}) {
		openPage(modal, { ...options, modal: true });
	}

	function closePage(modal = false) {
		if (modal) {
			if (modalStack.length > 0) {
				setModalStack(modalStack.slice(0, modalStack.length - 1));
			}
		} else {
			if (pageStack.length > 0) {
				setPageStack(pageStack.slice(0, pageStack.length - 1));
			}
		}
	}

	function closeModal() {
		closePage(true);
	}

	useImperativeHandle(ref, () => ({
		openPage,
		closePage,
		openModal,
		closeModal,
	}));

	const providerValue = {
		openPage,
		closePage: () => closePage(),
		openModal,
		closeModal: () => closeModal(),
	};

	return (
		<div className="size-full relative" ref={ref}>
			<motion.div
				className={classNames("size-full", modalStack.length > 0 && "pointer-events-none")}
			>
				<AnimatePresence>
					{[home, ...pageStack].map((page, index) => (
						<motion.div
							key={index}
							className={classNames(
								"size-full flex flex-col absolute inset-0 overflow-hidden bg-primary"
							)}
							initial={
								index == 0
									? {}
									: { translateX: "100%", boxShadow: "-32px 0 32px -32px rgba(0,0,0,0)" }
							}
							exit={{ translateX: "100%", boxShadow: "-32px 0 32px -32px rgba(0,0,0,0)" }}
							animate={{
								translateX: index == pageStack.length ? 0 : -50,
								pointerEvents: index == pageStack.length ? "auto" : "none",
								boxShadow: "-32px 0 32px -32px rgba(0,0,0,0.2)",
							}}
							transition={TRANSITION}
						>
							<motion.div
								className="size-full"
								animate={{
									opacity: index < pageStack.length ? 0.2 : 1,
								}}
								initial={false}
								transition={TRANSITION}
							>
								<PageStackContext.Provider
									value={{
										...providerValue,
										pageType: "page",
										pageCount: pageStack.length + 1,
										active: index === pageStack.length && modalStack.length === 0,
									}}
								>
									{page.component}
								</PageStackContext.Provider>
							</motion.div>
						</motion.div>
					))}
				</AnimatePresence>
			</motion.div>
			<AnimatePresence>
				{modalStack.map((modal, index) => (
					<motion.div key={index} className="absolute inset-0 flex-col center py-3 max-h-full">
						{index === 0 && (
							<>
								<motion.div
									className="absolute inset-0 bg-primary pointer-events-none"
									initial={{ opacity: 0 }}
									animate={{ opacity: 0.6 }}
									exit={{ opacity: 0 }}
									transition={TRANSITION}
								/>
								<motion.div
									className="absolute inset-0 pointer-events-none"
									transition={TRANSITION}
								/>
							</>
						)}
						<div className="absolute inset-0 cursor-pointer" onClick={closeModal} />
						<motion.div
							animate={{
								scale: modalStack.length > index + 1 ? 0.95 : 1,
							}}
							initial={false}
							transition={TRANSITION}
							className="w-full max-h-full max-w-[315px]"
						>
							<motion.div
								initial={{
									opacity: 0,
									scale: 0.95,
									pointerEvents: "auto",
									boxShadow:
										"0px 10px 30px 0px rgba(0, 0, 0, .1), 0px 1px 4px 0px rgba(0, 0, 0, .02)",
								}}
								animate={{
									opacity: 1,
									scale: 1,
									pointerEvents: "auto",
									boxShadow:
										modalStack.length > index + 1
											? "0px 10px 30px 0px rgba(0, 0, 0, .05), 0px 1px 4px 0px rgba(0, 0, 0, .01)"
											: "0px 10px 30px 0px rgba(0, 0, 0, .1), 0px 1px 4px 0px rgba(0, 0, 0, .02)",
								}}
								exit={{
									opacity: 0,
									scale: 0.95,
									pointerEvents: "none",
									boxShadow:
										"0px 10px 30px 0px rgba(0, 0, 0, .1), 0px 1px 4px 0px rgba(0, 0, 0, .02)",
								}}
								transition={TRANSITION}
								className="rounded-xl bg-modal w-full max-h-full overflow-hidden flex-col"
							>
								<motion.div
									className="w-full max-h-full overflow-hidden flex-col"
									animate={{
										opacity: modalStack.length > index + 1 ? 0.5 : 1,
									}}
									initial={false}
									transition={TRANSITION}
								>
									<PageStackContext.Provider
										key={index}
										value={{
											...providerValue,
											pageType: "modal",
											openPage: openModal,
											closePage: closeModal,
											pageCount: modalStack.length,
											active: index === modalStack.length - 1,
										}}
									>
										{modal.component}
									</PageStackContext.Provider>
								</motion.div>
							</motion.div>
						</motion.div>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
});

export function BackButton({ className = "", onClick = null, disableEsc = false }) {
	const { closePage, active, pageType, pageCount } = usePageStack();

	const showBackButton = useMemo(() => (pageType === "modal" ? pageCount > 0 : pageCount > 1), []);

	useEffect(() => {
		if (disableEsc || !active || !showBackButton) {
			return;
		}

		const handleKeyDown = (event) => {
			if (event.key === "Escape") {
				if (onClick) {
					onClick();
				} else {
					closePage();
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [active, disableEsc]);

	return showBackButton ? (
		<span
			onClick={onClick || closePage}
			className={`text-tertiary flex flex-row items-center gap-1 cursor-pointer w-max pr-1 ${className}`}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
				<g transform="translate(1.5 1)">
					<path
						d="M 3.5 0 L 0 4 L 3.5 7.5"
						fill="transparent"
						strokeWidth="1.5"
						stroke="currentColor"
						strokeLinecap="round"
					></path>
				</g>
			</svg>
			Back
		</span>
	) : null;
}
